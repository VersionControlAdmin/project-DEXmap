'use client'

import React, { useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

export default function UploadPicturesButton({ onUpload }) {
  const fileInputRef = useRef(null)

  const handleClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files)
    onUpload(files)
  }

  return (
    <div className="w-full flex justify-center mb-4">
      <Button
        onClick={handleClick}
        className="bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center space-x-2"
      >
        <Upload className="w-5 h-5" />
        <span>Upload Picture(s)</span>
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*"
        className="hidden"
      />
    </div>
  )
}