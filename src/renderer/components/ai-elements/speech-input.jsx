"use client";;
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/shadcn";
import { MicIcon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const hasMediaRecorder = () =>
  typeof window !== "undefined" &&
  "MediaRecorder" in window &&
  "mediaDevices" in navigator;

export const SpeechInput = ({
  className,
  onTranscriptionChange,
  onAudioRecorded,
  ...props
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [supported] = useState(hasMediaRecorder);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const onTranscriptionChangeRef = useRef(onTranscriptionChange);
  const onAudioRecordedRef = useRef(onAudioRecorded);

  onTranscriptionChangeRef.current = onTranscriptionChange;
  onAudioRecordedRef.current = onAudioRecorded;

  // Cleanup on unmount
  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!onAudioRecordedRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener("stop", async () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        streamRef.current = null;

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        if (audioBlob.size > 0 && onAudioRecordedRef.current) {
          setIsProcessing(true);
          try {
            const transcript = await onAudioRecordedRef.current(audioBlob);
            if (transcript) {
              onTranscriptionChangeRef.current?.(transcript);
            }
          } catch {
            // Error handling delegated to the onAudioRecorded caller
          } finally {
            setIsProcessing(false);
          }
        }
      });

      mediaRecorder.addEventListener("error", () => {
        setIsListening(false);
        for (const track of stream.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      });

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isListening, startRecording, stopRecording]);

  const isDisabled = !supported || !onAudioRecorded || isProcessing;

  return (
    <div className="relative inline-flex items-center justify-center">
      {isListening &&
        [0, 1, 2].map((index) => (
          <div
            className="absolute inset-0 animate-ping rounded-full border-2 border-red-400/30"
            key={index}
            style={{
              animationDelay: `${index * 0.3}s`,
              animationDuration: "2s",
            }} />
        ))}
      <Button
        className={cn("relative z-10 rounded-full", isListening && "bg-destructive text-white hover:bg-destructive/80 hover:text-white", className)}
        type="button"
        disabled={isDisabled}
        onClick={toggle}
        {...props}>
        {isProcessing && <Spinner />}
        {!isProcessing && isListening && <SquareIcon className="size-4" />}
        {!(isProcessing || isListening) && <MicIcon className="size-4" />}
      </Button>
    </div>
  );
};
