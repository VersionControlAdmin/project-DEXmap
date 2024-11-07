'use client'

import React, { useState, useCallback } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { X } from "lucide-react"

export default function ImageEditor({ imageUrl, onSave, onCancel }) {
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState(null)
  const [isOpen, setIsOpen] = useState(true)

  const onImageLoad = useCallback((image) => {
    const aspect = 16 / 9
    const width = image.width > image.height * aspect ? 
      image.height * aspect : 
      image.width
    const height = image.width > image.height * aspect ? 
      image.height : 
      image.width / aspect
    const y = (image.height - height) / 2
    const x = (image.width - width) / 2

    setCrop({ unit: 'px', width, height, x, y })
  }, [])

  const getCroppedImg = useCallback((image, crop) => {
    const canvas = document.createElement('canvas')
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    canvas.width = crop.width
    canvas.height = crop.height
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height
      )
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas is empty')
          return
        }
        resolve(URL.createObjectURL(blob))
      }, 'image/jpeg')
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (completedCrop) {
      const image = document.querySelector('img')
      const croppedImageUrl = await getCroppedImg(image, completedCrop)
      onSave(croppedImageUrl)
      setIsOpen(false)
    }
  }, [completedCrop, getCroppedImg, onSave])

  const handleCancel = useCallback(() => {
    onCancel()
    setIsOpen(false)
  }, [onCancel])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] p-0">
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-lg font-semibold">Edit Image</h2>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </div>
          <div className="flex-grow p-4 overflow-auto">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={16 / 9}
            >
              <img src={imageUrl} alt="Edit" onLoad={(e) => onImageLoad(e.currentTarget)} />
            </ReactCrop>
          </div>
          <div className="flex justify-between p-4 border-t">
            <Button variant="outline" onClick={handleCancel}>Cancel Edit</Button>
            <Button onClick={handleSave}>Save Edits</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}