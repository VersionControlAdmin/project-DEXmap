import React, { useState, useEffect } from "react";
import RemoveButton from "./RemoveButton";
import { colorOptions } from "./IconMarkerSelector";

const ICON_SIZE = 40;

const RedDotMarker = ({
  dot,
  position,
  onDragEnd,
  mapRef,
  onClick,
  isSelected,
  onRemove,
}) => {
  const [currentPosition, setCurrentPosition] = useState(position);

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(dot.id);
  };

  useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  // Get color class based on dot's color property
  const getColorClass = () => {
    const colorOption = colorOptions.find((c) => c.id === dot.color);
    return colorOption ? colorOption.class : "text-[#BD3D2F]"; // Default to red if no color specified
  };

  const IconComponent = dot.icon;

  return (
    <div
      className={`red-dot-marker ${isSelected ? "selected" : ""}`}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${currentPosition[0] - ICON_SIZE/2}px, ${
          currentPosition[1] - ICON_SIZE/2
        }px)`,
        cursor: "grab",
        zIndex: isSelected ? 50 : 1,
        touchAction: "none",
        userSelect: "none",
        width: `${ICON_SIZE}px`,
        height: `${ICON_SIZE}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setDragImage(new Image(), 0, 0);
      }}
      onDrag={(e) => {
        if (e.clientX === 0 && e.clientY === 0) return;

        const mapContainer = mapRef.current.getContainer();
        const rect = mapContainer.getBoundingClientRect();
        const newX = e.clientX - rect.left;
        const newY = e.clientY - rect.top;

        setCurrentPosition([newX, newY]);
        const newGeoCoords = mapRef.current.unproject([newX, newY]);
        onDragEnd(dot.id, [newGeoCoords.lng, newGeoCoords.lat]);
      }}
      onDragEnd={(e) => {
        if (mapRef.current) {
          const newGeoCoords = mapRef.current.unproject(currentPosition);
          onDragEnd(dot.id, [newGeoCoords.lng, newGeoCoords.lat]);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <IconComponent
        style={{ width: `${ICON_SIZE}px`, height: `${ICON_SIZE}px` }}
        className={`${getColorClass()} ${
          isSelected ? "brightness-110" : ""
        }`}
        fill={dot.filled ? "currentColor" : "none"}
      />
      {isSelected && (
        <div
          className="absolute -bottom-5 left-3/4 -translate-x-1/2"
          onClick={(e) => e.stopPropagation()}
        >
          <RemoveButton onClick={handleRemove} />
        </div>
      )}
    </div>
  );
};

export default RedDotMarker;
