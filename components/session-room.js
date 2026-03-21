"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { buildKickoffPrompt, buildStaticReport, getAgent } from "@/lib/agents";
import {
  clearSessionHeartbeat,
  LIVE_SOCKET_URL,
  writeSessionHeartbeat,
} from "@/lib/runtime";

const MIC_ACCESS_REQUIRED_CODE = "MIC_ACCESS_REQUIRED";

function floatTo16BitPCM(float32Array) {
  const int16Array = new Int16Array(float32Array.length);

  for (let index = 0; index < float32Array.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[index]));
    int16Array[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return int16Array;
}

function downsampleFloat32(buffer, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let index = offsetBuffer; index < nextOffsetBuffer && index < buffer.length; index += 1) {
      accum += buffer[index];
      count += 1;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function int16ToBase64(int16Array) {
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary);
}

function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

function pcmBytesToInt16Array(pcmBytes) {
  return new Int16Array(
    pcmBytes.buffer,
    pcmBytes.byteOffset,
    Math.floor(pcmBytes.byteLength / 2)
  );
}

function downsampleInt16(input, inputRate = 24000, outputRate = 16000) {
  if (outputRate === inputRate) {
    return input;
  }

  const ratio = inputRate / outputRate;
  const newLength = Math.floor(input.length / ratio);
  const result = new Int16Array(newLength);

  let offsetResult = 0;
  let offsetInput = 0;

  while (offsetResult < result.length) {
    const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let index = offsetInput; index < nextOffsetInput && index < input.length; index += 1) {
      accum += input[index];
      count += 1;
    }

    result[offsetResult] = count > 0 ? Math.round(accum / count) : 0;
    offsetResult += 1;
    offsetInput = nextOffsetInput;
  }

  return result;
}

function int16ToUint8Array(int16Array) {
  return new Uint8Array(int16Array.buffer);
}

function formatError(error) {
  if (!error) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || error.toString();
  }

  if (typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch (_jsonError) {
      return String(error);
    }
  }

  return String(error);
}

function createMicAccessError(error) {
  const wrappedError = new Error(formatError(error));
  wrappedError.code = MIC_ACCESS_REQUIRED_CODE;
  return wrappedError;
}

export function SessionRoom({ agentId }) {
  const router = useRouter();
  const agent = getAgent(agentId);
  const { state, actions } = useAppState();

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const simliClientRef = useRef(null);
  const browserLiveSocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const processorNodeRef = useRef(null);
  const bootedRef = useRef(false);
  const bootInProgressRef = useRef(false);
  const endingRef = useRef(false);
  const callEndedRef = useRef(false);
  const kickoffSentRef = useRef(false);
  const hiddenMessagesRef = useRef(new Set());
  const currentModelTextRef = useRef("");
  const isMutedRef = useRef(false);

  const kickoffPrompt = useMemo(
    () => buildKickoffPrompt(agentId, state.customBrief),
    [agentId, state.customBrief]
  );

  const [statusMessage, setStatusMessage] = useState("Preparing the rehearsal room...");
  const [connectionPhase, setConnectionPhase] = useState("booting");
  const [composerValue, setComposerValue] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentModelText, setCurrentModelText] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [micPermission, setMicPermission] = useState("pending");
  const [isMuted, setIsMuted] = useState(false);

  const logSession = (message, payload) => {
    if (typeof payload === "undefined") {
      console.log(`[PitchMirror][Session:${agentId}] ${message}`);
      return;
    }

    console.log(`[PitchMirror][Session:${agentId}] ${message}`, payload);
  };

  const logSessionError = (message, error) => {
    console.error(`[PitchMirror][Session:${agentId}] ${message}`, error);
  };

  const updateStatus = (message, phase) => {
    logSession("status update", { message, phase });
    setStatusMessage(message);
    if (phase) {
      setConnectionPhase(phase);
    }
  };

  const sendAudioChunkToSimli = (base64Audio) => {
    if (!simliClientRef.current) {
      return;
    }

    const pcm24kBytes = base64ToUint8Array(base64Audio);
    const pcm24kInt16 = pcmBytesToInt16Array(pcm24kBytes);
    const pcm16kInt16 = downsampleInt16(pcm24kInt16, 24000, 16000);
    const pcm16kBytes = int16ToUint8Array(pcm16kInt16);

    simliClientRef.current.sendAudioData(pcm16kBytes);
  };

  const cleanupMicrophone = () => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const cleanupRoom = async () => {
    logSession("cleanup started");
    cleanupMicrophone();

    const socket = browserLiveSocketRef.current;
    browserLiveSocketRef.current = null;
    if (socket) {
      logSession("closing browser live socket");
      socket.close();
    }

    const simliClient = simliClientRef.current;
    simliClientRef.current = null;
    if (simliClient) {
      try {
        logSession("stopping Simli client");
        await simliClient.stop();
      } catch (error) {
        logSessionError("Simli stop failed during cleanup", error);
      }
    }
  };

  const requestMicrophoneAccess = async () => {
    if (mediaStreamRef.current && mediaStreamRef.current.active) {
      logSession("reusing previously granted microphone stream");
      setMicPermission("granted");
      return mediaStreamRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw createMicAccessError("Microphone access is not supported in this browser.");
    }

    updateStatus("Requesting microphone access...", "mic-request");
    setMicPermission("requesting");
    setSessionError("");
    logSession("requesting microphone access");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      setMicPermission("granted");
      logSession("microphone access granted", {
        audioTracks: stream.getAudioTracks().length,
      });
      return stream;
    } catch (error) {
      const formatted = formatError(error);
      setMicPermission("denied");
      setSessionError("Mic access required. Allow microphone access to join the rehearsal room.");
      updateStatus("Microphone access required before entering the room.", "mic-required");
      logSessionError("microphone access denied", error);
      throw createMicAccessError(formatted);
    }
  };

  const connectMicrophoneStream = async (stream) => {
    const socket = browserLiveSocketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("The live questioning bridge is not connected yet.");
    }

    if (audioContextRef.current) {
      logSession("microphone processor already connected");
      return;
    }

    const AudioConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioConstructor) {
      throw new Error("This browser does not support microphone streaming.");
    }

    const audioContext = new AudioConstructor();
    if (audioContext.state === "suspended") {
      await audioContext.resume().catch(() => {});
    }

    const sourceNode = audioContext.createMediaStreamSource(stream);
    const processorNode = audioContext.createScriptProcessor(4096, 1, 1);

    audioContextRef.current = audioContext;
    sourceNodeRef.current = sourceNode;
    processorNodeRef.current = processorNode;

    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    processorNode.onaudioprocess = (event) => {
      if (
        isMutedRef.current ||
        !browserLiveSocketRef.current ||
        browserLiveSocketRef.current.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleFloat32(input, audioContext.sampleRate, 16000);
      const pcm16 = floatTo16BitPCM(downsampled);
      const audioBase64 = int16ToBase64(pcm16);

      browserLiveSocketRef.current.send(
        JSON.stringify({
          type: "user_audio",
          data: audioBase64,
          mimeType: "audio/pcm;rate=16000",
        })
      );
    };

    logSession("microphone processor connected");
  };

  const sendKickoffPrompt = () => {
    const socket = browserLiveSocketRef.current;

    if (
      kickoffSentRef.current ||
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      logSession("kickoff prompt skipped", {
        alreadySent: kickoffSentRef.current,
        hasSocket: Boolean(socket),
        readyState: socket?.readyState,
      });
      return;
    }

    hiddenMessagesRef.current.add(kickoffPrompt);
    kickoffSentRef.current = true;
    logSession("sending kickoff prompt", kickoffPrompt);

    socket.send(
      JSON.stringify({
        type: "user_text",
        text: kickoffPrompt,
      })
    );
  };

  const connectBrowserLiveSocket = () =>
    new Promise((resolve, reject) => {
      logSession("opening live bridge socket", LIVE_SOCKET_URL);
      const socket = new WebSocket(LIVE_SOCKET_URL);
      browserLiveSocketRef.current = socket;

      socket.onopen = () => {
        logSession("live bridge socket opened");
        updateStatus("Bridge connected. Priming the judge...", "bridged");
        socket.send(JSON.stringify({ type: "get_history" }));
        resolve();

        window.setTimeout(() => {
          sendKickoffPrompt();
          updateStatus("Judge prompt queued. Waiting for the opening question...", "live");
        }, 250);
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        logSession("live bridge message received", message.type);

        if (message.type === "status") {
          updateStatus(message.message);
          return;
        }

        if (message.type === "error") {
          logSessionError("live bridge returned error", message);
          setSessionError(message.message || "Live bridge error");
          return;
        }

        if (message.type === "model_text") {
          const nextText = `${currentModelTextRef.current}${message.text || ""}`;
          currentModelTextRef.current = nextText;
          setCurrentModelText(nextText);
          return;
        }

        if (message.type === "audio_chunk") {
          sendAudioChunkToSimli(message.data);
          return;
        }

        if (message.type === "turn_complete") {
          if (currentModelTextRef.current.trim() && browserLiveSocketRef.current) {
            browserLiveSocketRef.current.send(
              JSON.stringify({
                type: "save_model_text",
                text: currentModelTextRef.current.trim(),
              })
            );
          }

          currentModelTextRef.current = "";
          setCurrentModelText("");
          updateStatus("Turn complete. Your move.");
          return;
        }

        if (message.type === "history") {
          const nextHistory = (message.history || []).filter(
            (entry) => !hiddenMessagesRef.current.has((entry.text || "").trim())
          );
          setConversationHistory(nextHistory);
        }
      };

      socket.onerror = () => {
        logSessionError("live bridge socket error", {
          readyState: socket.readyState,
        });
        reject(new Error("The live questioning bridge could not connect."));
      };

      socket.onclose = () => {
        logSession("live bridge socket closed", { readyState: socket.readyState });
        if (!endingRef.current && !callEndedRef.current) {
          updateStatus("Bridge closed.", "closed");
        }
      };
    });

  const startSimli = async () => {
    updateStatus("Creating the Simli session token...", "token");
    logSession("requesting Simli session token", {
      faceId: state.credentials.faceId,
    });

    const { SimliClient, LogLevel, generateSimliSessionToken } = await import("simli-client");
    const tokenResponse = await generateSimliSessionToken({
      apiKey: state.credentials.apiKey,
      config: {
        faceId: state.credentials.faceId,
        handleSilence: true,
        maxSessionLength: 600,
        maxIdleTime: 180,
        model: "fasttalk",
      },
    });
    const sessionToken =
      tokenResponse?.session_token ||
      tokenResponse?.sessionToken ||
      tokenResponse;

    logSession("received Simli token response", {
      hasSessionToken: Boolean(sessionToken),
      responseKeys:
        tokenResponse && typeof tokenResponse === "object"
          ? Object.keys(tokenResponse)
          : [],
    });

    if (!sessionToken || typeof sessionToken !== "string") {
      throw new Error(`Invalid Simli token response: ${formatError(tokenResponse)}`);
    }

    updateStatus("Starting the avatar stream...", "avatar");
    logSession("starting Simli client");

    await new Promise((resolve, reject) => {
      let settled = false;

      const simliClient = new SimliClient(
        sessionToken,
        videoRef.current,
        audioRef.current,
        null,
        LogLevel.DEBUG,
        "livekit"
      );

      simliClientRef.current = simliClient;

      simliClient.on("start", () => {
        logSession("Simli start event received");
        if (settled) {
          return;
        }

        settled = true;
        updateStatus("Avatar ready. Connecting the live questioning bridge...", "avatar-live");
        resolve();
      });

      simliClient.on("stop", () => {
        logSession("Simli stop event received");
        if (!endingRef.current) {
          updateStatus("Avatar stream stopped.", "stopped");
        }
      });

      simliClient.on("error", (error) => {
        const nextError = formatError(error);
        logSessionError("Simli error event received", error);
        if (!settled) {
          settled = true;
          reject(new Error(nextError));
        }
        setSessionError(nextError);
      });

      simliClient.on("startup_error", (message) => {
        const nextError = formatError(message);
        logSessionError("Simli startup_error event received", message);
        if (!settled) {
          settled = true;
          reject(new Error(nextError));
        }
        setSessionError(nextError);
      });

      simliClient.start().catch((error) => {
        logSessionError("Simli start() rejected", error);
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      });
    });
  };

  const bootSession = async () => {
    if (bootInProgressRef.current || endingRef.current || callEndedRef.current) {
      logSession("boot request ignored", {
        bootInProgress: bootInProgressRef.current,
        ending: endingRef.current,
        ended: callEndedRef.current,
      });
      return;
    }

    bootInProgressRef.current = true;
    setSessionError("");
    logSession("session boot starting");

    try {
      const stream = await requestMicrophoneAccess();
      await startSimli();
      await connectBrowserLiveSocket();
      await connectMicrophoneStream(stream);
      setIsMuted(false);
      isMutedRef.current = false;
      actions.setSessionStatus(agentId, "live");
      logSession("session boot completed");
    } catch (error) {
      logSessionError("session boot failed", error);

      if (error?.code === MIC_ACCESS_REQUIRED_CODE) {
        logSession("session boot paused until microphone access is granted");
      } else {
        setSessionError(formatError(error) || "Failed to start the live room.");
        updateStatus("The session could not be started.", "error");
        actions.endSession();
      }
    } finally {
      bootInProgressRef.current = false;
    }
  };

  const handleSendText = () => {
    const text = composerValue.trim();
    const socket = browserLiveSocketRef.current;

    if (!text) {
      return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      logSession("text send blocked because live bridge is not connected");
      setSessionError("The live questioning bridge is not connected yet.");
      return;
    }

    currentModelTextRef.current = "";
    setCurrentModelText("");

    socket.send(
      JSON.stringify({
        type: "user_text",
        text,
      })
    );

    logSession("text message sent", text);
    setComposerValue("");
    setSessionError("");
    updateStatus("Message sent. Waiting for the judge response...");
  };

  const handleToggleMute = () => {
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    logSession("microphone mute toggled", { muted: nextMuted });
  };

  const handleRetryMicrophone = () => {
    logSession("retrying session boot after microphone prompt");
    setMicPermission("pending");
    bootSession();
  };

  const handleEndCall = async () => {
    if (endingRef.current || callEndedRef.current) {
      return;
    }

    endingRef.current = true;
    logSession("end call requested");
    updateStatus("Ending the rehearsal room...", "ending");

    await cleanupRoom();

    const report = buildStaticReport(agentId, state.customBrief);
    callEndedRef.current = true;
    actions.finishSession(agentId, report);
    logSession("session finished and report generated", report);
    router.replace(`/agents/${agentId}#evaluation`);
  };

  useEffect(() => {
    hiddenMessagesRef.current = new Set([kickoffPrompt]);
    logSession("kickoff prompt prepared", kickoffPrompt);
  }, [kickoffPrompt]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncHeartbeat = () => writeSessionHeartbeat(agentId);
    const clearHeartbeat = () => clearSessionHeartbeat(agentId);

    syncHeartbeat();
    logSession("session heartbeat started");

    const intervalId = window.setInterval(syncHeartbeat, 1000);
    window.addEventListener("pagehide", clearHeartbeat);
    window.addEventListener("beforeunload", clearHeartbeat);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", clearHeartbeat);
      window.removeEventListener("beforeunload", clearHeartbeat);
      clearHeartbeat();
      logSession("session heartbeat stopped");
    };
  }, [agentId]);

  useEffect(() => {
    if (bootedRef.current) {
      logSession("boot skipped because session is already initialized");
      return undefined;
    }

    bootedRef.current = true;

    if (!state.credentials.apiKey.trim() || !state.credentials.faceId.trim()) {
      logSession("session boot failed because credentials are missing");
      setSessionError("Missing Simli credentials. Return to the agent page and add them first.");
      actions.endSession();
      return undefined;
    }

    actions.startSession(agentId, "connecting");
    bootSession();

    return () => {
      endingRef.current = true;
      logSession("session component cleanup running");

      cleanupRoom().finally(() => {
        if (!callEndedRef.current) {
          logSession("cleanup ended session without final report");
          actions.endSession();
        }
      });
    };
  }, [actions, agentId, state.credentials.apiKey, state.credentials.faceId, kickoffPrompt]);

  const isCallLive = connectionPhase === "live";
  const showMicRequiredOverlay = micPermission === "denied";
  const overlayTitle = showMicRequiredOverlay
    ? "Mic access required"
    : connectionPhase === "error"
      ? "Room blocked"
      : connectionPhase === "mic-request"
        ? "Allow microphone access"
        : "Building live room";
  const overlayMessage = showMicRequiredOverlay
    ? "The rehearsal room needs microphone access before the avatar can join. Allow mic access and try again."
    : sessionError || statusMessage;

  return (
    <div className="session-shell">
      <header className="session-topbar">
        <div>
          <span className="section-kicker">{agent.badge}</span>
          <h1 className="session-title">{agent.name}</h1>
        </div>

        <div className="topbar-meta">
          <ThemeToggle />
          <div className="status-pill">{statusMessage}</div>
          <button type="button" className="danger-button" onClick={handleEndCall}>
            End session
          </button>
        </div>
      </header>

      <div className="session-layout">
        <section className="stage-panel">
          <div className="stage-shell">
            <video ref={videoRef} className="avatar-video" autoPlay playsInline />
            <audio ref={audioRef} autoPlay />

            {!isCallLive ? (
              <div className="stage-overlay">
                <div className="loading-stack">
                  <div className="loading-card">
                    <strong>{overlayTitle}</strong>
                    <p>{overlayMessage}</p>
                    {showMicRequiredOverlay ? (
                      <div className="button-row">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={handleRetryMicrophone}
                        >
                          Allow microphone
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="floating-note-grid">
            <div className="floating-note">
              <span className="field-label">Audience</span>
              <strong>{agent.audience}</strong>
            </div>
            <div className="floating-note">
              <span className="field-label">Focus</span>
              <strong>{agent.focus.join(" / ")}</strong>
            </div>
            <div className="floating-note">
              <span className="field-label">Deck</span>
              <strong>{state.deck.fileName || "No supporting file"}</strong>
            </div>
          </div>

          <div className="control-row">
            <button
              type="button"
              className="secondary-button"
              onClick={handleToggleMute}
              disabled={!isCallLive}
            >
              {isMuted ? "Unmute mic" : "Mute mic"}
            </button>
          </div>

          <div className="composer-row">
            <input
              className="input"
              type="text"
              value={composerValue}
              placeholder="Send a text message into the live room"
              onChange={(event) => setComposerValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSendText();
                }
              }}
              disabled={!isCallLive}
            />
            <button
              type="button"
              className="primary-button"
              onClick={handleSendText}
              disabled={!isCallLive}
            >
              Send
            </button>
          </div>

          {sessionError && !showMicRequiredOverlay ? <p className="error-text">{sessionError}</p> : null}
        </section>

        <aside className="transcript-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Live transcript</span>
              <h2 className="panel-title">Conversation feed</h2>
            </div>
          </div>

          <div className="transcript-list">
            {conversationHistory.length === 0 && !currentModelText ? (
              <div className="empty-state">
                <strong>Waiting for the opening turn.</strong>
                <p>The avatar room will show both sides of the conversation here.</p>
              </div>
            ) : null}

            {conversationHistory.map((entry, index) => (
              <div
                key={`${entry.role}-${index}-${entry.text}`}
                className={`transcript-bubble ${entry.role === "user" ? "is-user" : "is-model"}`}
              >
                <span className="transcript-role">
                  {entry.role === "user" ? "You" : agent.name}
                </span>
                <p className="transcript-text">{entry.text}</p>
              </div>
            ))}

            {currentModelText ? (
              <div className="transcript-bubble is-model">
                <span className="transcript-role">{agent.name}</span>
                <p className="transcript-text">{currentModelText}</p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
