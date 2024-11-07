import React, { useState, useEffect } from "react";

const RedDotMarker = ({ dot, position, onDragEnd, mapRef }) => {  // Add mapRef prop
  const [currentPosition, setCurrentPosition] = useState(position);

  useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  return (
    <div
      className="red-dot-marker"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${currentPosition[0] - 15}px, ${
          currentPosition[1] - 15
        }px)`,  // Remove duplicate transform
        cursor: "grab",
        zIndex: 1,
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

        const mapContainer = mapRef.current.getContainer();  // Use mapRef instead
        const rect = mapContainer.getBoundingClientRect();
        const newX = e.clientX - rect.left;
        const newY = e.clientY - rect.top;

        setCurrentPosition([newX, newY]);
      }}
      onDragEnd={(e) => {
        if (mapRef.current) {  // Use mapRef instead
          const newGeoCoords = mapRef.current.unproject(currentPosition);
          onDragEnd(dot.id, [newGeoCoords.lng, newGeoCoords.lat]);
        }
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
        }}
        draggable={false}
      />
    </div>
  );
};

export default RedDotMarker;