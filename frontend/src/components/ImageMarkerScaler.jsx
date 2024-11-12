"use client";

import React, { useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export default function ImageMarkerScaler({ onScaleChange, initialScale = 1 }) {
  const [isActive, setIsActive] = useState(false);

  const handleScaleChange = (value) => {
    const scaleFactor = calculateScaleFactor(value[0]);
    onScaleChange(scaleFactor);
  };

  const calculateScaleFactor = (sliderValue) => {
    if (sliderValue <= 50) {
      return 0.01 + 0.99 * Math.pow(sliderValue / 50, 2);
    } else {
      return 1 + (sliderValue - 50) / 25;
    }
  };

  const initialSliderValue = () => {
    if (initialScale <= 1) {
      return Math.sqrt((initialScale - 0.01) / 0.99) * 50;
    } else {
      return (initialScale - 1) * 25 + 50;
    }
  };

  return (
    <div className="w-[200px]">
      <div className="bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg">
        <div className="text-center text-xs font-medium text-gray-700 mb-2">
          Resize
        </div>
        <SliderPrimitive.Root
          defaultValue={[initialSliderValue()]}
          max={100}
          step={1}
          onValueChange={handleScaleChange}
          className="relative flex items-center select-none touch-none w-full h-4"
          onMouseDown={() => setIsActive(true)}
          onMouseUp={() => setIsActive(false)}
          onMouseLeave={() => setIsActive(false)}
        >
          <SliderPrimitive.Track className="bg-slate-100 relative grow rounded-full h-1">
            <SliderPrimitive.Range className="absolute bg-slate-900 rounded-full h-full" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={cn(
              "block w-5 h-5 rounded-full border-2 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              isActive ? "border-slate-900" : "border-slate-200"
            )}
          />
        </SliderPrimitive.Root>
      </div>
    </div>
  );
}
