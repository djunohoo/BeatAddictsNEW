export interface LoadedSample {
  id: string;
  name: string;
  duration: number;
  buffer: AudioBuffer;
  file: File;
}

const supportedAudioTypes = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wave",
  "audio/webm",
  "audio/flac",
];

export const isSupportedAudioFile = (file: File): boolean => {
  return (
    file.type.startsWith("audio/") || supportedAudioTypes.includes(file.type)
  );
};

// Decoded PCM audio is roughly 10x a compressed file's size in memory;
// this caps the raw file size to keep worst-case decoded memory reasonable.
export const MAX_SAMPLE_FILE_BYTES = 50 * 1024 * 1024; // 50MB

export const loadAudioFile = async (
  audioCtx: AudioContext,
  file: File,
): Promise<LoadedSample> => {
  if (file.size > MAX_SAMPLE_FILE_BYTES) {
    throw new Error(
      `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB) — max ${MAX_SAMPLE_FILE_BYTES / (1024 * 1024)}MB.`,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
    audioCtx.decodeAudioData(
      arrayBuffer,
      resolve,
      // decodeAudioData's error callback isn't guaranteed to receive a real
      // Error/DOMException with a usable .message in every browser.
      (err) => reject(err instanceof Error ? err : new Error("Could not decode audio data — the file may be corrupt or in an unsupported format.")),
    );
  });

  return {
    id: `${file.name}-${Date.now()}`,
    name: file.name,
    duration: buffer.duration,
    buffer,
    file,
  };
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
