"use client";

import React, { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Heart, Home, MapPin, Camera, Gem, Plane, Star } from "lucide-react";

const icons = [
  { id: "heart", Icon: Heart, alt: "Heart", filled: true },
  { id: "home", Icon: Home, alt: "Home", filled: false },
  { id: "map-pin", Icon: MapPin, alt: "Map Pin", filled: false },
  { id: "camera", Icon: Camera, alt: "Camera", filled: false },
  { id: "gem", Icon: Gem, alt: "Gem", filled: false },
  { id: "plane", Icon: Plane, alt: "Plane", filled: true },
  { id: "star", Icon: Star, alt: "Star", filled: true },
];

export const colorOptions = [
  { id: "red", class: "text-[#BD3D2F]" },
  { id: "blue", class: "text-[#0306FF]" },
  { id: "black", class: "text-black" },
  { id: "green", class: "text-[#003220]" },
  { id: "yellow", class: "text-[#FFBF37]" },
];

export default function Component({ onSelectIcon, position = { x: 0, y: 0 } }) {
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);

  const handleSelectIcon = (iconId) => {
    setSelectedIcon(iconId);
    setSelectedColor(null);
  };

  const handleSelectColor = (color) => {
    setSelectedColor(color);
    const selectedIconObj = icons.find((icon) => icon.id === selectedIcon);
    onSelectIcon({ 
      id: selectedIconObj.id,
      Icon: selectedIconObj.Icon, 
      filled: selectedIconObj.filled,
      color 
    });
  };

  return (
    <div
      className="absolute z-50"
      style={{
        left: position.x,
        top: position.y - 60,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="flex flex-col items-center space-y-2">
        {selectedIcon && (
          <div className="p-2 bg-white rounded-lg shadow-lg">
            <div className="flex space-x-2">
              {colorOptions.map((color) => {
                const selectedIconObj = icons.find(
                  (icon) => icon.id === selectedIcon
                );
                const IconComponent = selectedIconObj.Icon;
                return (
                  <button
                    key={color.id}
                    className={`size-10 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center ${
                      selectedColor === color.id ? "ring-2 ring-black" : ""
                    }`}
                    onClick={() => handleSelectColor(color.id)}
                  >
                    <IconComponent
                      className={`size-8 ${color.class}`}
                      fill={selectedIconObj.filled ? "currentColor" : "none"}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="p-2 bg-white rounded-full shadow-lg">
          <ToggleGroup
            type="single"
            value={selectedIcon}
            onValueChange={handleSelectIcon}
          >
            {icons.map((icon) => (
              <ToggleGroupItem
                key={icon.id}
                value={icon.id}
                aria-label={icon.alt}
                className="data-[state=on]:bg-slate-100 relative size-12"
              >
                <icon.Icon
                  className={` border-black ${
                    selectedColor && selectedIcon === icon.id
                      ? colorOptions.find((c) => c.id === selectedColor).class
                      : ""
                  }`}
                  fill={icon.filled ? "currentColor" : "none"}
                />
                {selectedIcon === icon.id && (
                  <div className="absolute -top-1 left-1/2 w-1 h-1 bg-black rounded-full transform -translate-x-1/2" />
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}
