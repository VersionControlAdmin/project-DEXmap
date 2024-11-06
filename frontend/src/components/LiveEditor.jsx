import React, { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import * as exifr from "exifr";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  MapboxExportControl,
  Size,
  PageOrientation,
  Format,
  DPI,
} from "@watergis/mapbox-gl-export";
import "@watergis/mapbox-gl-export/dist/mapbox-gl-export.css";
import html2canvas from "html2canvas";
import axios from "axios";
import Moveable from "react-moveable";

const LiveEditor = ({ selectedImages, setSelectedImages }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [redDots, setRedDots] = useState([]);
  const [activeMarkerId, setActiveMarkerId] = useState(null); // Track the active marker
  const [isUIVisible, setIsUIVisible] = useState(true); // Track UI visibility
  const [markerSizesWidth, setMarkerSizesWidth] = useState([]);
  const [markerSizesHeight, setMarkerSizesHeight] = useState([]);
  const [markerStyles, setMarkerStyles] = useState([]);
  const [uiElements, setUiElements] = useState({
    controls: true,
    handles: true,
    buttons: true,
  });
  const [initialMoveablePictureRenderFlag, setInitialMoveabePictureRenderFlag] =
    useState(false);
  const [headlineText, setHeadlineText] = useState("Headline");
  const [dividerText, setDividerText] = useState("Divider");
  const [taglineText, setTaglineText] = useState("Tagline");
  const [connections, setConnections] = useState([]);

  // Image Marker Functionality
  // New handler for marker interactions
  const handleMarkerClick = useCallback((markerId) => {
    setActiveMarkerId(markerId);
    setMarkers((prevMarkers) =>
      prevMarkers.map((marker) => ({
        ...marker,
        isActive: marker.id === markerId,
      }))
    );
  }, []);

  const updateLines = useCallback(() => {
    if (!map.current) return;

    markers.forEach((marker, index) => {
      const redDot = redDots[index];
      if (!marker || !redDot) return;

      const lineId = `line-${index}`;
      if (map.current.getSource(lineId)) {
        map.current.getSource(lineId).setData({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [marker.coordinates, redDot.coordinates],
          },
        });
      }
    });
  }, [markers, redDots]);

  // New handler for marker resizing
  const handleResize = useCallback(
    (markerId, newSize) => {
      setMarkerStyles((prev) =>
        prev.map((style) =>
          style.id === markerId
            ? {
                ...style,
                width: Math.max(50, newSize.width), // Ensure minimum width
                height: Math.max(50, newSize.height), // Ensure minimum height
              }
            : style
        )
      );
      updateLines(); // Update lines after resize
    },
    [updateLines]
  );

  // New handler for marker dragging
  const handleDragEnd = useCallback((markerId, newCoords) => {
    setMarkers((prev) =>
      prev.map((marker) =>
        marker.id === markerId ? { ...marker, coordinates: newCoords } : marker
      )
    );
    updateLines();
  }, []);

  const ImageMarker = ({
    image,
    style,
    isActive,
    onResize,
    onClick,
    onDragEnd,
  }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [showResizeUI, setShowResizeUI] = useState(false);
    const targetRef = useRef(null);
    const dragStartPos = useRef(null);
    
    const [pixelPosition, setPixelPosition] = useState(() => {
      if (map.current) {
        const pos = map.current.project(image.coordinates);
        return [pos.x, pos.y];
      }
      return [0, 0];
    });
  
    // Handle clicks outside to hide resize UI
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (!targetRef.current?.contains(e.target) && !e.target.className?.includes('moveable')) {
          setShowResizeUI(false);
        }
      };
  
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
  
    const handleMouseDown = (e) => {
      if (e.target.className?.includes('moveable')) return;
      dragStartPos.current = { x: e.clientX, y: e.clientY };
    };
  
    const handleMouseUp = (e) => {
      if (!dragStartPos.current) return;
      
      // If mouse hasn't moved much, consider it a click
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 5) { // threshold for click vs. drag
        setShowResizeUI(true);
      }
      dragStartPos.current = null;
    };
  
    const handleDragStart = (e) => {
      if (e.target.className?.includes('moveable')) return;
      setIsDragging(true);
    };
  
    const handleDrag = (e) => {
      if (!isDragging || !map.current) return;
  
      const mapContainer = map.current.getContainer();
      const rect = mapContainer.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;
  
      setPixelPosition([newX, newY]);
    };
  
    const handleDragEnd = () => {
      if (!isDragging || !map.current) return;
  
      const newGeoCoords = map.current.unproject(pixelPosition);
      onDragEnd(image.id, [newGeoCoords.lng, newGeoCoords.lat]);
      setIsDragging(false);
    };
  
    return (
      <>
        <div
          ref={targetRef}
          className="custom-marker"
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
            border: showResizeUI ? "2px solid lightblue" : "2px solid black",
            userSelect: "none",
            zIndex: showResizeUI ? 2 : 1,
            touchAction: "none",
            willChange: "transform",
            width: style.width + "px",
            height: style.height + "px",
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
        />
        {showResizeUI && (
          <Moveable
            target={targetRef.current}
            draggable={false}
            resizable={true}
            keepRatio={true}
            renderDirections={["nw", "ne", "sw", "se"]}
            edge={false}
            zoom={1}
            origin={false}
            padding={{ left: 0, top: 0, right: 0, bottom: 0 }}
            onResizeStart={(e) => {
              e.setOrigin(["%", "%"]);
              e.dragStart && e.dragStart.set(style.width, style.height);
            }}
            onResize={(e) => {
              const newWidth = e.width;
              const newHeight = e.height;
              onResize(image.id, { width: newWidth, height: newHeight });
            }}
          />
        )}
      </>
    );
  };

  // Modified toggleUIVisibility
  const toggleUIVisibility = useCallback(() => {
    setUiElements((prev) => ({
      controls: !prev.controls,
      handles: !prev.handles,
      buttons: !prev.buttons,
    }));
  }, []);

  const calculateInitialMarkerSizes = (images) => {
    const fixedHeight = Math.max(
      180,
      mapContainer.current.clientHeight / (images.length + 6)
    ); // Desired fixed height in pixels

    const sizes = images.map((image) => {
      const img = new Image();
      img.src = image.url;
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      const calculatedWidth = fixedHeight * aspectRatio;
      return { width: calculatedWidth, height: fixedHeight };
    });
    const widths = sizes.map((size) => size.width);
    const heights = sizes.map((size) => size.height);
    console.log(widths, heights);
    console.log(markerSizesHeight, markerSizesWidth);
    setMarkerSizesWidth(widths);
    setMarkerSizesHeight(heights);
    console.log(markerSizesHeight, markerSizesWidth);
  };

  const updateGeotags = async (images) => {
    const processImage = async (imageFile) => {
      try {
        const exifData = await exifr.gps(imageFile); // Extract GPS data directly
        if (exifData && exifData.latitude && exifData.longitude) {
          return {
            lat: exifData.latitude,
            lng: exifData.longitude,
          };
        }
        return null; // No geotags
      } catch (error) {
        console.error("Error reading EXIF data:", error);
        return null;
      }
    };

    const geotags = await Promise.all(
      images.map((image) => processImage(image.file)) // Process the actual File object
    );

    // Saves geotags in selectedImages
    const updatedImages = images.map((image, index) => {
      const geotag = geotags[index];
      return {
        ...image,
        coordinates: geotag ? [geotag.lng, geotag.lat] : null,
      };
    });
    setSelectedImages(updatedImages);
    return updatedImages;
  };

  // Use https://www.npmjs.com/package/react-image-file-resizer instead
  // Crops images (before rendering the final download version) according to the current state on screen (after user potentially cropped them)
  const cropImage = async (image) => {
    // Crop image according to user specifications and return the cropped version
    return new Promise((resolve) => {
      const img = new Image();
      img.src = image.url;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        // Get the current dimensions of the image on the screen
        const imgElement = document.querySelector(`img[src="${image.url}"]`);
        const displayedWidth = imgElement.clientWidth;
        const displayedHeight = imgElement.clientHeight;

        // Calculate the cropping dimensions based on the displayed size
        const cropWidth =
          (displayedWidth / imgElement.naturalWidth) * img.width;
        const cropHeight =
          (displayedHeight / imgElement.naturalHeight) * img.height;

        // Set canvas dimensions to the cropped size
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        // Draw the cropped image onto the canvas
        context.drawImage(
          img,
          (img.width - cropWidth) / 2,
          (img.height - cropHeight) / 2,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );
        canvas.toBlob((blob) => {
          const croppedUrl = URL.createObjectURL(blob);
          resolve(croppedUrl);
        });
      };
    });
  };

  const calculateCenterAndZoom = (images) => {
    if (images.length === 0) return { center: { lng: 0, lat: 0 }, zoom: 1 };

    let totalLng = 0;
    let totalLat = 0;
    let count = 0;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    images.forEach((image) => {
      const geotag = image.coordinates;
      if (geotag) {
        const [lng, lat] = geotag;
        totalLng += lng;
        totalLat += lat;
        count++;

        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    });

    const center =
      count > 0
        ? { lng: totalLng / count, lat: totalLat / count }
        : { lng: 0, lat: 0 };

    if (count === 1) {
      return { center, zoom: 15 };
    }

    const lngDiff = maxLng - minLng;
    const latDiff = maxLat - minLat;

    const R = 6371;

    const latDiffRadians = (latDiff * Math.PI) / 180;
    const lngDiffRadians = (lngDiff * Math.PI) / 180;
    const a =
      Math.sin(latDiffRadians / 2) * Math.sin(latDiffRadians / 2) +
      Math.cos((minLat * Math.PI) / 180) *
        Math.cos((maxLat * Math.PI) / 180) *
        Math.sin(lngDiffRadians / 2) *
        Math.sin(lngDiffRadians / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    let zoom;
    if (distance > 0) {
      const maxZoom = 22;
      const minZoom = 1;

      zoom = Math.min(
        maxZoom,
        Math.max(minZoom, 13 - Math.log(distance) / Math.log(2))
      );
    } else {
      zoom = 15;
    }

    return { center, zoom };
  };

  const initializeMap = async () => {
    if (map.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    const updatedImages = await updateGeotags(selectedImages);
    if (updatedImages.length > 0) {
      updateTextSectionWithLocation(updatedImages[0].coordinates);
    }
    setSelectedImages(updatedImages);
    const { center, zoom } = calculateCenterAndZoom(updatedImages);

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/dexmap/cm2ol7sge000p01pa0k4f092t",
      center: [center.lng, center.lat],
      zoom: zoom,
      preserveDrawingBuffer: true,
    });

    map.current.on("load", async () => {
      map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
      map.current.addControl(new mapboxgl.NavigationControl(), "top-left");
      calculateInitialMarkerSizes(updatedImages);
      addDownloadPluginFunctionality();
    });
    map.current.on("zoom", updateLines);
    map.current.on("move", updateLines);
  };

  //initializes map
  useEffect(() => {
    if (
      markerSizesWidth.length > 0 &&
      markerSizesHeight.length > 0 &&
      initialMoveablePictureRenderFlag === false
    ) {
      addRedDotMarkers(selectedImages);
      addMoveableUserPictures(selectedImages);
      addConnectingLines();
    }
  }, [markerSizesWidth, markerSizesHeight, selectedImages]);

  const addDownloadPluginFunctionality = () => {
    const exportControl = new MapboxExportControl({
      PageSize: Size.A3,
      PageOrientation: PageOrientation.Portrait,
      Format: Format.PNG,
      DPI: DPI[96],
      Crosshair: true,
      PrintableArea: true,
      Local: "en",
      accessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
    });
    map.current.addControl(exportControl, "top-right");
  };

  const addMoveableUserPictures = (images) => {
    setMarkers(
      images.map((image, index) => ({
        id: `marker-${index}`,
        ...image,
        isActive: false,
        style: {
          width: markerSizesWidth[index],
          height: markerSizesHeight[index],
        },
      }))
    );
  };

  const handleDownload = async () => {
    if (!mapContainer.current) return;

    // Hide UI elements before downloading
    toggleUIVisibility(false);

    const mapElement = mapContainer.current;
    html2canvas(mapElement, {
      scale: 4, // Increase scale for high resolution
      useCORS: true, // Handle cross-origin images
    }).then((canvas) => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "high-quality-map.png";
      link.click();

      // Re-show UI elements after download
      toggleUIVisibility(true);
    });
  };

  const addRedDotMarkers = (images) => {
    setRedDots(
      images.map((image, index) => ({
        id: `dot-${index}`,
        coordinates: image.coordinates,
        icon: "../assets/user-placeable-icons/heart.svg",
      }))
    );
  };

  const addConnectingLines = () => {
    markers.forEach((marker, index) => {
      const redDot = redDots[index];
      if (!marker || !redDot) return;

      const lineId = `line-${index}`;

      // Check if we already have this line
      if (!map.current.getSource(lineId)) {
        // Add new source and layer
        map.current.addSource(lineId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [marker.coordinates, redDot.coordinates],
            },
          },
        });

        map.current.addLayer({
          id: lineId,
          type: "line",
          source: lineId,
          paint: {
            "line-color": "#000000",
            "line-width": 1,
          },
        });
      }
    });
  };

  // Not working, needs an update
  const getClosestCorner = (marker, redDot) => {
    const [lng, lat] = marker.coordinates;

    // Get marker style for dimensions
    const markerStyle = markerStyles.find(
      (style) => style.id === marker.id
    ) || {
      width: markerSizesWidth[0],
      height: markerSizesHeight[0],
    };

    const markerWidth = parseFloat(markerStyle.width);
    const markerHeight = parseFloat(markerStyle.height);

    // Assuming we need to calculate based on the actual image size relative to the marker
    const imageWidthFactor = 2.5;
    const imageHeightFactor = 2.5;

    const actualImageWidth = markerWidth * imageWidthFactor;
    const actualImageHeight = markerHeight * imageHeightFactor;

    // Get the map's current zoom level and convert the pixel size to geographical units
    const zoomScale = Math.pow(2, -map.current.getZoom());

    // Calculate longitude and latitude offsets for each corner
    const lngOffset = actualImageWidth * zoomScale * 0.00001;
    const latOffset = actualImageHeight * zoomScale * 0.00001;

    // Define the corners based on the actual size of the picture
    const corners = [
      [lng - lngOffset, lat + latOffset], // Top left
      [lng + lngOffset, lat + latOffset], // Top right
      [lng - lngOffset, lat - latOffset], // Bottom left
      [lng + lngOffset, lat - latOffset], // Bottom right
    ];

    let closestCorner = corners[0];
    let minDistance = getDistance(closestCorner, redDot.coordinates);

    for (let i = 1; i < corners.length; i++) {
      const distance = getDistance(corners[i], redDot.coordinates);
      if (distance < minDistance) {
        closestCorner = corners[i];
        minDistance = distance;
      }
    }

    return closestCorner;
  };

  // Helper to calculate distance
  const getDistance = (pointA, pointB) => {
    const lngDiff = pointA[0] - pointB[0];
    const latDiff = pointA[1] - pointB[1];
    return Math.sqrt(lngDiff * lngDiff + latDiff * latDiff);
  };

  // Reddotmarker
  const RedDotMarker = ({ dot, position, onDragEnd }) => {
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
          transform: `translate(${currentPosition[0]}px, ${currentPosition[1]}px)`,
          cursor: "grab",
          zIndex: 1,
          touchAction: "none",
          userSelect: "none",
          width: "30px", // Match image width
          height: "30px", // Match image height
          display: "flex", // Add flex display
          alignItems: "center", // Center vertically
          justifyContent: "center", // Center horizontally
          transform: `translate(${currentPosition[0] - 15}px, ${
            currentPosition[1] - 15
          }px)`, // Offset by half width/height
        }}
        draggable="true"
        onDragStart={(e) => {
          e.dataTransfer.setDragImage(new Image(), 0, 0);
        }}
        onDrag={(e) => {
          if (e.clientX === 0 && e.clientY === 0) return;

          const mapContainer = map.current.getContainer();
          const rect = mapContainer.getBoundingClientRect();
          const newX = e.clientX - rect.left;
          const newY = e.clientY - rect.top;

          setCurrentPosition([newX, newY]);
        }}
        onDragEnd={(e) => {
          if (map.current) {
            const newGeoCoords = map.current.unproject(currentPosition);
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
            transform: "none", // Remove previous transform
          }}
          draggable={false}
        />
      </div>
    );
  };

  // all useEffects
  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    if (map.current && markers.length > 0 && redDots.length > 0) {
      addConnectingLines();
    }
    updateLines();
  }, [markers, redDots, updateLines]);

  // Update markers and red dots on map movement
  useEffect(() => {
    if (!map.current || (redDots.length === 0 && markers.length === 0)) return;

    const handleMapMove = () => {
      // Force re-render of markers and red dots when map moves
      if (redDots.length > 0) {
        setRedDots((prev) => [...prev]);
      }
      if (markers.length > 0) {
        setMarkers((prev) => [...prev]);
      }
    };

    map.current.on("move", handleMapMove);
    map.current.on("zoom", handleMapMove);

    return () => {
      if (map.current) {
        map.current.off("move", handleMapMove);
        map.current.off("zoom", handleMapMove);
      }
    };
  }, [map.current, redDots.length, markers.length]);

  const setTextSection = (headline, divider, tagline) => {
    setHeadlineText(headline);
    setDividerText(divider);
    setTaglineText(tagline);
  };

  const updateTextSectionWithLocation = async (coordinates) => {
    const [lng, lat] = coordinates;
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const locationData = response.data;
      const city =
        locationData.address.city ||
        locationData.address.town ||
        locationData.address.village ||
        "Unknown City";
      const country = locationData.address.country || "Unknown Country";
      setTextSection(
        city,
        country,
        `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );
    } catch (error) {
      console.error("Error fetching location data:", error);
    }
  };

  return (
    <div
      className="flex flex-col items-center"
      style={{ padding: "50px", backgroundColor: "#f5f5dc" }}
    >
      <div className="w-full flex justify-center">
        <div
          ref={mapContainer}
          style={{ width: "900px", height: "1260px", position: "relative" }}
          className="relative mb-4"
        >
          {markers.map((marker, index) => (
            <ImageMarker
              key={marker.id}
              image={marker}
              style={marker.style}
              isActive={marker.id === activeMarkerId}
              onResize={handleResize}
              onClick={handleMarkerClick}
              onDragEnd={handleDragEnd}
            />
          ))}
          {redDots.map((dot) => {
            if (!map.current) return null;
            const pixelPosition = map.current.project(dot.coordinates);

            return (
              <RedDotMarker
                key={dot.id}
                dot={dot}
                position={[pixelPosition.x, pixelPosition.y]}
                onDragEnd={(dotId, newCoords) => {
                  setRedDots((prev) =>
                    prev.map((d) =>
                      d.id === dotId ? { ...d, coordinates: newCoords } : d
                    )
                  );
                  // Update lines after moving red dot
                  updateLines();
                }}
              />
            );
          })}
          <div
            className="w-full flex flex-col items-center justify-center p-4 z-10"
            style={{
              backgroundColor: "#ffffff",
              height: "calc(100vh / 7)",
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              gap: "10px",
              borderTopLeftRadius: "20px",
              borderTopRightRadius: "20px",
              boxShadow: "0 -4px 8px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              className="text-center font-bold text-4xl font-sans"
              style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              {headlineText}
            </div>
            <div
              className="text-center text-2xl font-sans"
              style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              {dividerText}
            </div>
            <div
              className="text-center text-lg font-sans"
              style={{
                color: "#4a4a4a",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {taglineText}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={handleDownload}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
      >
        Download High-Quality Map as Image
      </button>
      <button
        onClick={toggleUIVisibility}
        className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-700"
      >
        Toggle UI visibility
      </button>
      <div className="flex flex-wrap justify-center">
        {selectedImages.map((image, index) => (
          <img
            key={index}
            src={image.url}
            alt={`Selected ${index}`}
            className="m-2 w-24 h-24 object-cover rounded shadow-lg"
          />
        ))}
      </div>
      <style>
        {`.mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib {display: none !important;}
          .resize-handle {
            position: absolute;
            width: 10px;
            height: 10px;
            background-color: white;
            border-radius: 2px;
            border: 1px solid lightblue;
            transition: background-color 0.2s;
          }
          .resize-handle:hover {
            background-color: blue;
          }
          .resize-handle.top-left { 
            top: -5px; 
            left: -5px; 
            cursor: nw-resize; 
          }
          .resize-handle.top-right { 
            top: -5px; 
            right: -5px; 
            cursor: ne-resize; 
          }
          .resize-handle.bottom-left { 
            bottom: -5px; 
            left: -5px; 
            cursor: sw-resize; 
          }
          .resize-handle.bottom-right { 
            bottom: -5px; 
            right: -5px; 
            cursor: se-resize; 
          }
          .red-dot-marker {
            transition: transform 0.1s ease-out;
          }
          .red-dot-marker.dragging {
            opacity: 0.8;
            transition: none;
          }
          .custom-marker.dragging {
            opacity: 0.8;
            transition: none;
            cursor: grabbing !important;
          }
          `}
      </style>
    </div>
  );
};

export default LiveEditor;
