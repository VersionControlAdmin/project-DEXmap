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
import RedDotMarker from "./RedDotMarkers";
import ImageMarker from "./ImageMarker";
import IconMarkerSelector from "./IconMarkerSelector";

const LiveEditor = ({ selectedImages, setSelectedImages }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [redDots, setRedDots] = useState([]);
  const [selectedDotId, setSelectedDotId] = useState(null);
  const [activeMarkerId, setActiveMarkerId] = useState(null); // Track the active marker
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

  //handle Icon dot actions & selections
  const handleDotClick = (dotId) => {
    setSelectedDotId(dotId);
  };

  // Add handler for icon selection
  const handleIconSelect = (icon) => {
    setRedDots((prev) =>
      prev.map((dot) => (dot.id === selectedDotId ? { ...dot, icon } : dot))
    );
    setSelectedDotId(null);
  };

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

  // New handler for marker dragging
  const handleDragEnd = useCallback((markerId, newCoords) => {
    setMarkers((prev) =>
      prev.map((marker) =>
        marker.id === markerId ? { ...marker, coordinates: newCoords } : marker
      )
    );
    updateLines();
  }, []);

  // Modified toggleUIVisibility
  const toggleUIVisibility = useCallback(() => {
    // Hide/show Mapbox controls
    const mapControls = document.querySelectorAll(
      ".mapboxgl-control-container"
    );
    mapControls.forEach((control) => {
      control.style.display = uiElements.controls ? "none" : "block";
    });

    setUiElements((prev) => ({
      controls: !prev.controls,
      handles: !prev.controls,
      buttons: !prev.controls,
    }));
    setActiveMarkerId(null);
  }, [uiElements.controls]);

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
    setMarkerSizesWidth(widths);
    setMarkerSizesHeight(heights);
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

  const calculateOptimalDistribution = (images, mapBounds, map) => {
    const minPadding = 100; // Minimum padding around each image and red dot
    const mapWidth = map.getContainer().offsetWidth;
    const mapHeight = map.getContainer().offsetHeight;

    return images.map((image, index) => {
      const baseCoords = image.coordinates;
      const screenPos = map.project(baseCoords);
      const totalImages = images.length;

      // Get the size of the image marker
      const markerWidth = markerSizesWidth[index];
      const markerHeight = markerSizesHeight[index];

      let adjustedPos = { x: screenPos.x, y: screenPos.y };

      if (totalImages === 1) {
        // One picture: top right
        adjustedPos.x += markerWidth / 2 + minPadding;
        adjustedPos.y -= markerHeight / 2 + minPadding;
      } else if (totalImages === 2) {
        // Two pictures: bottom left and top right
        if (index === 0) {
          adjustedPos.x -= markerWidth / 2 + minPadding;
          adjustedPos.y += markerHeight / 2 + minPadding;
        } else {
          adjustedPos.x += markerWidth / 2 + minPadding;
          adjustedPos.y -= markerHeight / 2 + minPadding;
        }
      } else if (totalImages === 3) {
        // Three pictures: triangle
        const triangleOffsets = [
          { x: 0, y: -markerHeight / 2 - minPadding }, // Top
          { x: -markerWidth / 2 - minPadding, y: markerHeight / 2 + minPadding }, // Bottom left
          { x: markerWidth / 2 + minPadding, y: markerHeight / 2 + minPadding }, // Bottom right
        ];
        adjustedPos.x += triangleOffsets[index].x;
        adjustedPos.y += triangleOffsets[index].y;
      } else {
        // Four or more pictures: circle
        const angle = (index / totalImages) * 2 * Math.PI;
        const radius = Math.max(markerWidth, markerHeight) * 1.5 + minPadding; // Ensure no overlap
        adjustedPos.x += radius * Math.cos(angle);
        adjustedPos.y += radius * Math.sin(angle);
      }

      // Ensure the adjusted position stays within viewport
      adjustedPos.x = Math.max(markerWidth / 2 + minPadding, Math.min(mapWidth - markerWidth / 2 - minPadding, adjustedPos.x));
      adjustedPos.y = Math.max(markerHeight / 2 + minPadding, Math.min(mapHeight - markerHeight / 2 - minPadding, adjustedPos.y));

      const constrainedCoords = map.unproject([adjustedPos.x, adjustedPos.y]);

      return {
        ...image,
        adjustedCoordinates: [constrainedCoords.lng, constrainedCoords.lat],
      };
    });
  };

  // Modify addMoveableUserPictures to use the new distribution logic
  const addMoveableUserPictures = (images) => {
    if (!map.current || !images.length) return;

    const distributedImages = calculateOptimalDistribution(
      images,
      map.current.getBounds(),
      map.current
    );

    setMarkers(
      distributedImages.map((image, index) => ({
        id: `marker-${index}`,
        ...image,
        coordinates: image.adjustedCoordinates,
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
    updateLines();
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
          onClick={(e) => {
            // Only deselect if clicking directly on the map container
            if (
              e.target === e.currentTarget ||
              e.target.classList.contains("mapboxgl-canvas")
            ) {
              setActiveMarkerId(null);
              setSelectedDotId(null);
              setMarkers((prev) =>
                prev.map((marker) => ({ ...marker, isActive: false }))
              );
            }
          }}
        >
          {markers.map((marker, index) => (
            <ImageMarker
              key={marker.id}
              image={marker}
              style={marker.style}
              isActive={marker.id === activeMarkerId}
              onClick={handleMarkerClick}
              onDragEnd={handleDragEnd}
              map={map.current}
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
                mapRef={map} // Add this prop
                onDragEnd={(dotId, newCoords) => {
                  setRedDots((prev) =>
                    prev.map((d) =>
                      d.id === dotId ? { ...d, coordinates: newCoords } : d
                    )
                  );
                  updateLines();
                }}
                onClick={() => handleDotClick(dot.id)}
                isSelected={selectedDotId === dot.id}
              />
            );
          })}
          {selectedDotId && (
            <IconMarkerSelector
              position={map.current.project(
                redDots.find((dot) => dot.id === selectedDotId).coordinates
              )}
              onSelectIcon={handleIconSelect}
            />
          )}
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
