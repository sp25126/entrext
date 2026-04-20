// src/hooks/useScreenCapture.ts
import { useRef, useCallback } from 'react'

export function useScreenCapture() {
  const streamRef  = useRef<MediaStream | null>(null)
  const videoRef   = useRef<HTMLVideoElement | null>(null)

  const init = useCallback(async (): Promise<boolean> => {
    try {
      // Ask user to share the current tab
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as MediaTrackConstraints,
        audio: false,
      })
      streamRef.current = stream

      // Create off-screen video element to receive the stream
      const video       = document.createElement('video')
      video.srcObject   = stream
      video.muted       = true
      await video.play()
      videoRef.current  = video

      // Stop stream when user revokes share
      stream.getVideoTracks()[0].onended = () => {
        streamRef.current = null
        videoRef.current  = null
      }
      return true
    } catch {
      console.warn('[ScreenCapture] Permission denied or not available')
      return false
    }
  }, [])

  const capture = useCallback(async (
    rect: { x: number; y: number; width: number; height: number } | null
  ): Promise<string | null> => {
    if (!videoRef.current || !rect) return null
    try {
      const video  = videoRef.current
      // Scale from CSS pixels to actual video resolution
      const scaleX = video.videoWidth  / window.innerWidth
      const scaleY = video.videoHeight / window.innerHeight
      const PAD    = 12

      const canvas = document.createElement('canvas')
      canvas.width  = (rect.width  + PAD * 2) * scaleX
      canvas.height = (rect.height + PAD * 2) * scaleY

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(
        video,
        (rect.x - PAD) * scaleX,
        (rect.y - PAD) * scaleY,
        canvas.width,
        canvas.height,
        0, 0, canvas.width, canvas.height
      )
      // Purple highlight border
      ctx.strokeStyle = '#a855f7'
      ctx.lineWidth   = 3
      ctx.strokeRect(PAD * scaleX, PAD * scaleY, rect.width * scaleX, rect.height * scaleY)

      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    videoRef.current  = null
  }, [])

  const isActive = useCallback(() => !!streamRef.current, [])

  return { init, capture, stop, isActive }
}
