import React, { useState, useEffect } from "react";
import RemoveButton from "./RemoveButton";

const RedDotMarker = ({
  dot,
  position,
  onDragEnd,
  mapRef,
  onClick,
  isSelected,
  onRemove,
}) => {
  // Add mapRef prop
  const [currentPosition, setCurrentPosition] = useState(position);

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(dot.id);
  };

  useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  return (
    <div
      className={`red-dot-marker ${isSelected ? "selected" : ""}`}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${currentPosition[0] - 15}px, ${
          currentPosition[1] - 15
        }px)`,
        cursor: "grab",
        zIndex: isSelected ? 50 : 1,
        touchAction: "none",
        userSelect: "none",
        width: "30px",
        height: "30px",
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
      <img
        src={dot.icon}
        alt="location marker"
        style={{
          width: "30px",
          height: "30px",
          pointerEvents: "none",
          transform: "none",
          filter: isSelected ? "brightness(1.2)" : "none",
        }}
        draggable={false}
      />
      {isSelected && (
        <div
          style={{
            position: "absolute",
            bottom: "-20px",
            left: "75%",
            transform: "translateX(-50%)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <RemoveButton onClick={handleRemove} />
        </div>
      )}
    </div>
  );
};

export default RedDotMarker;
