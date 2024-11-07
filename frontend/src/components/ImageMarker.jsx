import React, { useState, useEffect, useRef } from "react";
import "./ImageMarker.css"; // Make sure to create this CSS file
import ImageEditor from "./ImageEditor";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion"; // Add this import
import RemoveButton from "./RemoveButton";

const ImageMarker = ({
  image,
  style,
  isActive,
  onClick,
  onDragEnd,
  onRemove,
  map,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(image.coordinates);
  const [pixelPosition, setPixelPosition] = useState(() => {
    if (map) {
      const pos = map.project(image.coordinates);
      return [pos.x, pos.y];
    }
    return [0, 0];
  });
  const [currentImage, setCurrentImage] = useState(image.url); // State for current image
  const [originalImage] = useState(image.url); // State for original image
  const [isEditing, setIsEditing] = useState(false); // State for editor visibility

  // Set initial coordinates with offset
  useEffect(() => {
    if (!map) return;

    // const mapBounds = map.getBounds();
    // const offsetLng =
    //   (mapBounds.getNorthEast().lng - image.coordinates[0]) * 0.3;
    // const offsetLat =
    //   (mapBounds.getNorthEast().lat - image.coordinates[1]) * 0.3;

    // const adjustedCoords = [
    //   image.coordinates[0] + offsetLng,
    //   image.coordinates[1] + offsetLat,
    // ];

    const adjustedCoords = [image.coordinates[0], image.coordinates[1]];

    setPosition(adjustedCoords);
    const pos = map.project(adjustedCoords);
    setPixelPosition([pos.x, pos.y]);

    requestAnimationFrame(() => {
      onDragEnd(image.id, adjustedCoords);
    });
  }, []);

  // Update pixel position when map moves
  useEffect(() => {
    if (!map) return;

    const updatePosition = () => {
      const pos = map.project(position);
      setPixelPosition([pos.x, pos.y]);
    };

    updatePosition(); // Initial position
    map.on("move", updatePosition);
    map.on("zoom", updatePosition);

    return () => {
      map.off("move", updatePosition);
      map.off("zoom", updatePosition);
    };
  }, [map, position]);

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
    const newGeoCoords = map.unproject([newX, newY]);
    setPosition([newGeoCoords.lng, newGeoCoords.lat]);

    if (
      newGeoCoords.lng !== image.coordinates[0] ||
      newGeoCoords.lat !== image.coordinates[1]
    ) {
      onDragEnd(image.id, [newGeoCoords.lng, newGeoCoords.lat]);
    }
  };

  useEffect(() => {
    const newGeoCoords = map.unproject(pixelPosition);
    onDragEnd(image.id, [newGeoCoords.lng, newGeoCoords.lat]);
  }, []);

  const handleDragEnd = () => {
    if (!isDragging || !map) return;

    const newGeoCoords = map.unproject(pixelPosition);
    setPosition([newGeoCoords.lng, newGeoCoords.lat]);
    setIsDragging(false);
    onClick(null);
  };

  const handleClick = (e) => {
    if (!isDragging) {
      e.stopPropagation();
      onClick(image.id);
    }
  };

  const handleCropAndResize = (e) => {
    e.stopPropagation(); // Prevent event bubbling
    setIsEditing(true);
  };

  const handleSave = (newImageUrl) => {
    setCurrentImage(newImageUrl);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(image.id);
  };

  return (
    <div style={{ position: "relative" }}>
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
          backgroundImage: `url(${currentImage})`,
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
      {isActive && (
        <div className="image-marker-edit-panel">
          <motion.div
            className="absolute z-10"
            style={{
              top: `${pixelPosition[1] + style.height / 2 + 5}px`,
              left: `${pixelPosition[0] + style.width / 2 - 150}px`,
            }}
          >
            <Button
              className="w-[150px] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full py-2 px-4 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105"
              onClick={handleCropAndResize}
            >
              <span className="mr-2">✂️</span>
              Crop & Resize
            </Button>
          </motion.div>
          <motion.div
            className="absolute z-10"
            style={{
              top: `${pixelPosition[1] + style.height / 2 + 15}px`,
              left: `${pixelPosition[0] - style.width / 2 + 27}px`,
            }}
          >
            <RemoveButton onClick={handleRemove} />
          </motion.div>
        </div>
      )}
      {isEditing && (
        <ImageEditor
          key={isEditing ? "editing" : "not-editing"} // Add key to force remount
          imageUrl={originalImage}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default ImageMarker;
