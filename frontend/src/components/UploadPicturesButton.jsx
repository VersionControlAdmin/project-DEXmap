"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function UploadPicturesButton({ onUpload }) {
  const fileInputRef = useRef(null);
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    fileInputRef.current.click();
    setIsClicked(true);
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    onUpload(files);
  };

  return (
    <div className="w-full flex justify-center mb-4">
      <Button
        onClick={handleClick}
        className={`
          bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 
          text-gray-800 font-semibold py-2 px-6 rounded-full shadow-lg hover:shadow-xl 
          transition-all duration-300 ease-in-out transform hover:scale-105 
          flex items-center space-x-2 relative overflow-hidden
          ${
            !isClicked
              ? `
            before:absolute before:inset-0 before:rounded-[inherit]
            before:bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.6)_50%,transparent_75%,transparent_100%)]
            before:bg-[length:250%_250%,100%_100%] before:bg-[position:200%_0,0_0]
            before:bg-no-repeat before:[transition:background-position_0s_ease]
            before:z-[1] before:mix-blend-overlay
            hover:before:bg-[position:-100%_0,0_0] hover:before:duration-[1500ms]
            animation-pulse
          `
              : ""
          }
        `}
      >
        <Upload className="w-5 h-5 relative z-[2]" />
        <span className="relative z-[2]">Upload Picture(s)</span>
        {!isClicked && (
          <div className="absolute inset-0 bg-white opacity-0 animate-shine" />
        )}
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
  );
}
