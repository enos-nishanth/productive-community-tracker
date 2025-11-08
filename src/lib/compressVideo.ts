// src/lib/compressVideo.ts

export const compressVideo = async (file: File): Promise<File> => {
  try {
    // ✅ Dynamically import — ensures correct ESM loading
    const ffmpegModule = await import("@ffmpeg/ffmpeg");
    const createFFmpeg =
      (ffmpegModule as any).createFFmpeg || (ffmpegModule as any).default.createFFmpeg;
    const fetchFile =
      (ffmpegModule as any).fetchFile || (ffmpegModule as any).default.fetchFile;

    if (!createFFmpeg || !fetchFile) {
      throw new Error("FFmpeg failed to load properly");
    }

    const ffmpeg = createFFmpeg({ log: true });

    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    // Write video file to FFmpeg's in-memory filesystem
    ffmpeg.FS("writeFile", file.name, await fetchFile(file));

    // Run compression command
    await ffmpeg.run(
      "-i",
      file.name,
      "-vcodec",
      "libx264",
      "-crf",
      "30",
      "-preset",
      "ultrafast",
      "-movflags",
      "faststart",
      "output.mp4"
    );

    // Read result back
    const data = ffmpeg.FS("readFile", "output.mp4");
    const compressedFile = new File([data.buffer], "compressed.mp4", {
      type: "video/mp4",
    });

    // Cleanup
    ffmpeg.FS("unlink", file.name);
    ffmpeg.FS("unlink", "output.mp4");

    return compressedFile;
  } catch (err) {
    console.error("❌ Video compression failed:", err);
    return file; // fallback to original file
  }
};
