import React, { useState, useEffect, useRef } from "react";
import "./ImageMarker.css"; // Make sure to create this CSS file
import ImageEditor from "./ImageEditor";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion"; // Add this import
import RemoveButton from "./RemoveButton";
import ImageMarkerScaler from "./ImageMarkerScaler";

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
  const [imageSize, setImageSize] = useState(style); // Add this state
  const [scale, setScale] = useState(1); // Add this state for scaling

  //   useEffect(() => {
  //     console.log("image", image);
  //   }, [image]);
  // Add this function to update dimensions when image changes
  const updateImageDimensions = (imageUrl) => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      let newWidth = style.width * scale; // Apply scale to width
      let newHeight = newWidth / aspectRatio;

      // Cap the dimensions at 400 px
      if (newWidth > 400) {
        newWidth = 400;
        newHeight = newWidth / aspectRatio;
      }
      if (newHeight > 400) {
        newHeight = 400;
        newWidth = newHeight * aspectRatio;
      }

      setImageSize({ width: newWidth, height: newHeight });
    };
    img.src = imageUrl;
  };

  // Update dimensions when currentImage changes
  useEffect(() => {
    updateImageDimensions(currentImage);
  }, [currentImage, scale]);

  // Update dimensions when scale changes
  useEffect(() => {
    updateImageDimensions(currentImage);
  }, [currentImage, scale]);

  // Add handler for scale changes
  const handleScale = (newScale) => {
    setScale(newScale);
  };

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
          ...imageSize, // Use imageSize instead of style
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${pixelPosition[0] - imageSize.width / 2}px, ${
            pixelPosition[1] - imageSize.height / 2
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
              top: `${pixelPosition[1] + imageSize.height / 2 + 5}px`,
              left: `${pixelPosition[0] + imageSize.width / 2 - 100}px`,
            }}
          >
            <Button
              className="w-[100px] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full py-2 px-4 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105"
              onClick={handleCropAndResize}
            >
              <span className="mr-2">✂️</span>
              Crop
            </Button>
          </motion.div>
          <motion.div
            className="absolute z-10"
            style={{
              top: `${
                pixelPosition[1] +
                imageSize.height / 2 +
                (imageSize.width < 150 ? 56 : 15)
              }px`,
              left: `${
                imageSize.width < 150
                  ? pixelPosition[0] + imageSize.width / 2 - 10
                  : pixelPosition[0] - imageSize.width / 2 + 27
              }px`,
            }}
          >
            <RemoveButton onClick={handleRemove} />
          </motion.div>
          <motion.div
            className="absolute z-10"
            style={{
              top: `${pixelPosition[1] - imageSize.height / 2 - 50}px`,
              left: `${pixelPosition[0] - 100}px`,
            }}
          >
            <ImageMarkerScaler
              onScaleChange={handleScale}
              initialScale={scale}
            />
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
