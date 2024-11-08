import React, { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const icons = [
  { id: "pin", src: "../assets/user-placeable-icons/heart.svg", alt: "Heart" },
  { id: "home", src: "../assets/user-placeable-icons/home.svg", alt: "Home" },
  { id: "work", src: "../assets/user-placeable-icons/medal.svg", alt: "Medal" },
  {
    id: "favorite",
    src: "../assets/user-placeable-icons/star.svg",
    alt: "Star",
  },
];

export default function IconMarkerSelector({ onSelectIcon, position }) {
  const [selectedIcon, setSelectedIcon] = useState(null);

  const handleSelectIcon = (iconId) => {
    const selectedIconObj = icons.find((icon) => icon.id === iconId);
    setSelectedIcon(iconId);
    onSelectIcon(selectedIconObj.src); // Send the icon source instead of just ID
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
      <div className="flex flex-col items-center">
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
                className="data-[state=on]:bg-slate-100"
              >
                <img src={icon.src} alt={icon.alt} className="w-6 h-6" />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}
