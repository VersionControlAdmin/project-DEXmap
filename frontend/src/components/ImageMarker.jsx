import React, { useState, useEffect, useRef } from "react";
import "./ImageMarker.css"; // Make sure to create this CSS file

const ImageMarker = ({ image, style, isActive, onClick, onDragEnd, map }) => {
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef(image.coordinates);
  const [pixelPosition, setPixelPosition] = useState(() => {
    if (map) {
      const pos = map.project(image.coordinates);
      return [pos.x, pos.y];
    }
    return [0, 0];
  });

  // Update pixel position when map moves
  useEffect(() => {
    if (!map) return;

    const updatePosition = () => {
      const pos = map.project(image.coordinates);
      setPixelPosition([pos.x, pos.y]);
    };

    updatePosition(); // Initial position
    map.on("move", updatePosition);
    map.on("zoom", updatePosition);

    return () => {
      map.off("move", updatePosition);
      map.off("zoom", updatePosition);
    };
  }, [map, image.coordinates]);

  const handleDragStart = (e) => {
    e.preventDefault();
    setIsDragging(true);
    onClick(image.id);
  };

  const handleDrag = (e) => {
    if (!isDragging || !map) return;

    const mapContainer = map.getContainer();
    const rect = mapContainer.getBoundingClientRect();
    const newX = e.clientX - rect.left;
    const newY = e.clientY - rect.top;

    setPixelPosition([newX, newY]);
    onClick(image.id);
  };

  const handleDragEnd = () => {
    if (!isDragging || !map) return;

    const newGeoCoords = map.unproject(pixelPosition);
    positionRef.current = [newGeoCoords.lng, newGeoCoords.lat];
    onDragEnd(image.id, [newGeoCoords.lng, newGeoCoords.lat]);
    setIsDragging(false);
    onClick(null);
  };

  const handleClick = (e) => {
    if (!isDragging) {
      e.stopPropagation();
      onClick(image.id);
    }
  };

  return (
    <div
      className={`custom-marker ${isActive ? "active" : ""} ${
        isDragging ? "dragging" : ""
      }`}
      style={{
        ...style,
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${pixelPosition[0] - style.width / 2}px, ${
          pixelPosition[1] - style.height / 2
        }px)`,
        cursor: isDragging ? "grabbing" : "grab",
        backgroundImage: `url(${image.url})`,
        backgroundSize: "cover",
        borderRadius: "10px",
        border: isActive ? "4px solid lightblue" : "2px solid black",
        userSelect: "none",
        zIndex: isActive ? 2 : 1,
        touchAction: "none",
        willChange: "transform",
      }}
      onMouseDown={handleDragStart}
      onMouseMove={handleDrag}
      onMouseUp={handleDragEnd}
      onClick={handleClick}
    />
  );
};

export default ImageMarker;
