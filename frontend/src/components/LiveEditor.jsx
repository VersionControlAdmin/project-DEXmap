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
import MapTextSection from "./MapTextSection";
import UploadPicturesButton from "./UploadPicturesButton";
import TransmitDataButton from "./TransmitDataButton";
import LocationForm from "./LocationForm";

const LiveEditor = ({ selectedImages, setSelectedImages }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [redDots, setRedDots] = useState([]);
  const [selectedDotId, setSelectedDotId] = useState(null);
  const [uiElements, setUiElements] = useState({
    controls: true,
    handles: true,
    buttons: true,
  });
  const [headlineText, setHeadlineText] = useState("Headline");
  const [dividerText, setDividerText] = useState("Divider");
  const [taglineText, setTaglineText] = useState("Tagline");
  const [nextMarkerId, setNextMarkerId] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);
  const [newImages, setNewImages] = useState([]); // To hold new images being uploaded
  const [isImageSizesUpdated, setIsImageSizesUpdated] = useState(false); // Track if sizes are ready
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [currentImageWithoutLocation, setCurrentImageWithoutLocation] =
    useState(null);

  // Image Marker Functionality
  // New handler for marker interactions
  const handleMarkerClick = useCallback((markerId) => {
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

    // Remove obsolete lines
    const existingLayers = map.current.getStyle().layers;
    existingLayers.forEach((layer) => {
      if (layer.id.startsWith("lineConnectingImageMarkerAndReddot-")) {
        const markerId = layer.id.split("-")[1];
        const hasMatchingMarker = markers.some(
          (m) => m.id === `imageMarker-${markerId}`
        );
        if (!hasMatchingMarker) {
          map.current.removeLayer(layer.id);
          map.current.removeSource(layer.id);
        }
      }
    });

    // Update existing lines
    markers.forEach((marker) => {
      const markerId = marker.id.split("-")[1];
      const lineId = `lineConnectingImageMarkerAndReddot-${markerId}`;
      const matchingDot = redDots.find(
        (dot) => dot.id === `reddotForImageMarker-${markerId}`
      );

      if (!matchingDot) {
        if (map.current.getLayer(lineId)) {
          map.current.removeLayer(lineId);
          map.current.removeSource(lineId);
        }
        return;
      }

      if (map.current.getSource(lineId)) {
        map.current.getSource(lineId).setData({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [marker.coordinates, matchingDot.coordinates],
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

    // Deactivate all markers
    setMarkers((prev) =>
      prev.map((marker) => ({ ...marker, isActive: false }))
    );
  }, [uiElements.controls]);

  const updateGeotags = async (images) => {
    const processImage = async (imageFile) => {
      try {
        const exifData = await exifr.gps(imageFile.file); // Use imageFile.file instead of imageFile
        if (exifData && exifData.latitude && exifData.longitude) {
          return {
            lat: exifData.latitude,
            lng: exifData.longitude,
          };
        }
        console.warn("No GPS data found for image:", imageFile.file.name);
        return null;
      } catch (error) {
        console.error("Error reading EXIF data:", error);
        return null;
      }
    };

    const geotags = await Promise.all(
      images.map((image) => processImage(image))
    );

    return images.map((image, index) => {
      const geotag = geotags[index];
      return {
        ...image,
        coordinates: geotag ? [geotag.lng, geotag.lat] : null,
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
    // calculateInitialMarkerSizes(updatedImages);

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
      addDownloadPluginFunctionality();
    });
    map.current.on("zoom", updateLines);
    map.current.on("move", updateLines);
  };

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

  const calculateOptimalDistribution = (
    images,
    mapBounds,
    map,
    isInitialDistribution
  ) => {
    console.log("calculateOptimalDistribution started");
    const minPadding = 100; // Minimum padding around each image and red dot
    const mapWidth = map.getContainer().offsetWidth;
    const mapHeight = map.getContainer().offsetHeight;

    return images.map((image, index) => {
      const baseCoords = image.coordinates;
      const screenPos = map.project(baseCoords);
      const totalImages = images.length;
      // Get the size of the image marker
      const markerWidth = image.width || 180;
      const markerHeight = image.height || 240;
      let adjustedPos = { x: screenPos.x, y: screenPos.y };
      console.log("original pos", adjustedPos);
      if (totalImages === 1 || !isInitialDistribution) {
        // One picture: top right
        console.log("Case One executed");
        adjustedPos.x += markerWidth / 2 + minPadding;
        adjustedPos.y -= markerHeight / 2 + minPadding;
        console.log("adjusted pos", adjustedPos);
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
          {
            x: -markerWidth / 2 - minPadding,
            y: markerHeight / 2 + minPadding,
          }, // Bottom left
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
      adjustedPos.x = Math.max(
        markerWidth / 2 + minPadding,
        Math.min(mapWidth - markerWidth / 2 - minPadding, adjustedPos.x)
      );
      adjustedPos.y = Math.max(
        markerHeight / 2 + minPadding,
        Math.min(mapHeight - markerHeight / 2 - minPadding, adjustedPos.y)
      );

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

    const newMarkers = images.map((image, index) => {
      const currentId = nextMarkerId + index;
      return {
        id: `imageMarker-${currentId}`,
        ...image,
        coordinates: image.adjustedCoordinates,
        isActive: false,
        width: image.width || 180,
        height: image.height || 240,
      };
    });

    setMarkers((prev) => [...prev, ...newMarkers]);
    setNextMarkerId(nextMarkerId + images.length);
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
    if (!map.current || !images.length) return;

    const newDots = images.map((_, index) => {
      const currentId = nextMarkerId + index;
      return {
        id: `reddotForImageMarker-${currentId}`,
        coordinates: images[index].coordinates,
        icon: "../assets/user-placeable-icons/heart.svg",
      };
    });

    setRedDots((prev) => [...prev, ...newDots]);
  };

  const addConnectingLines = () => {
    markers.forEach((marker) => {
      const markerId = marker.id.split("-")[1];
      const redDot = redDots.find(
        (dot) => dot.id === `reddotForImageMarker-${markerId}`
      );
      if (!marker || !redDot) return;

      const lineId = `lineConnectingImageMarkerAndReddot-${markerId}`;

      if (!map.current.getSource(lineId)) {
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
        `${lat.toFixed(4)}°N / ${lng.toFixed(4)}°E`
      );
    } catch (error) {
      console.error("Error fetching location data:", error);
    }
  };

  // Add this new handler
  const handleRemoveImageMarker = useCallback(
    (markerId) => {
      const id = markerId.split("-")[1];

      // Remove the connecting line
      if (map.current) {
        const lineId = `lineConnectingImageMarkerAndReddot-${id}`;
        if (map.current.getLayer(lineId)) {
          map.current.removeLayer(lineId);
          map.current.removeSource(lineId);
        }
      }

      // Remove the marker
      setMarkers((prev) => prev.filter((marker) => marker.id !== markerId));

      // Remove from selectedImages
      const markerIndex = markers.findIndex((m) => m.id === markerId);
      if (markerIndex !== -1) {
        setSelectedImages((prev) =>
          prev.filter((_, index) => index !== markerIndex)
        );
      }
    },
    [markers]
  );

  const handleRemoveRedDotMarker = useCallback(
    (dotId) => {
      const dotIndex = redDots.findIndex((dot) => dot.id === dotId);

      // Remove the red dot
      setRedDots((prev) => prev.filter((dot) => dot.id !== dotId));

      // Remove the connecting line
      if (map.current) {
        const lineId = `line-${dotIndex}`;
        if (map.current.getSource(lineId)) {
          map.current.removeLayer(lineId);
          map.current.removeSource(lineId);
        }
      }

      // Reset selected dot if it was the one removed
      if (selectedDotId === dotId) {
        setSelectedDotId(null);
      }
    },
    [redDots, selectedDotId]
  );

  const handleUpload = async (files) => {
    try {
      const newImages = files.map((file) => ({
        file: file,
        url: URL.createObjectURL(file),
      }));

      const processedImages = await updateGeotags(newImages);

      // Check for images without coordinates
      const imagesWithoutLocation = processedImages.filter(
        (img) => !img.coordinates
      );
      if (imagesWithoutLocation.length > 0) {
        setCurrentImageWithoutLocation(imagesWithoutLocation[0]);
        setShowLocationForm(true);
        return;
      }

      // Calculate sizes and add them to the processed images
      const imagesWithSizes = await Promise.all(
        processedImages.map(async (image) => {
          const sizes = await calculateAndSetImageMarkerSize(image);
          return {
            ...image,
            width: sizes.width,
            height: sizes.height,
          };
        })
      );

      setNewImages(imagesWithSizes);
      setSelectedImages((prev) => [...prev, ...imagesWithSizes]);
      setIsImageSizesUpdated(true);
    } catch (error) {
      console.error("Error processing uploaded images:", error);
    }
  };

  const handleLocationSubmit = (location) => {
    if (currentImageWithoutLocation) {
      const updatedImage = {
        ...currentImageWithoutLocation,
        coordinates: [location.lng, location.lat],
      };

      setSelectedImages((prev) => [...prev, updatedImage]);
      setShowLocationForm(false);
      setCurrentImageWithoutLocation(null);

      const { center, zoom } = calculateCenterAndZoom([
        ...selectedImages,
        updatedImage,
      ]);

      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: zoom,
        duration: 0,
      });

      // Process the image with the new coordinates
      const distributedImage = calculateOptimalDistribution(
        [updatedImage],
        map.current.getBounds(),
        map.current,
        markers.length === 0
      );

      addRedDotMarkers(distributedImage);
      addMoveableUserPictures(distributedImage);
      // console.log("selectedImages[0]", selectedImages[0].coordinates);
      if (
        selectedImages[0]?.coordinates &&
        selectedImages[0].coordinates.length > 0
      ) {
        updateTextSectionWithLocation(selectedImages[0].coordinates);
      }
      console.log("updatedImage", updatedImage.coordinates);
      if (updatedImage.coordinates != []) {
        updateTextSectionWithLocation(updatedImage.coordinates);
      }
    }
  };

  // Initialize new uploaded images
  useEffect(() => {
    // Proceed only if image sizes have been updated and we have new images

    if (isImageSizesUpdated && newImages.length > 0) {
      console.log("newImages", newImages);
      console.log("selectedImages", selectedImages);
      const { center, zoom } = calculateCenterAndZoom([
        ...selectedImages,
        ...newImages,
      ]);
      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: zoom,
        duration: setIsInitialized ? 0 : 1000,
      });
      if (markers.length === 0 && redDots.length === 0) {
        const distributedInitialImages = calculateOptimalDistribution(
          newImages,
          map.current.getBounds(),
          map.current,
          true
        );
        addRedDotMarkers(distributedInitialImages);
        addMoveableUserPictures(distributedInitialImages);
        updateTextSectionWithLocation(selectedImages[0].coordinates);
        setIsInitialized(true);
      } else {
        const distributedNewImages = calculateOptimalDistribution(
          newImages,
          map.current.getBounds(),
          map.current,
          false
        );
        addMoveableUserPictures(distributedNewImages);
        addRedDotMarkers(newImages);
      }

      addConnectingLines();
      console.log("selectedImages", selectedImages);

      // Reset for the next batch of images
      setNewImages([]);
      setIsImageSizesUpdated(false);
    }
  }, [isImageSizesUpdated, newImages, markers, redDots]); // Dependencies include all relevant states to ensure they are updated

  const calculateAndSetImageMarkerSize = async (image) => {
    const fixedHeight = Math.max(
      180,
      mapContainer.current.clientHeight / (markers.length + 7)
    );

    try {
      const loadedImage = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = image.url;
      });

      const aspectRatio = loadedImage.naturalWidth / loadedImage.naturalHeight;
      const calculatedWidth = fixedHeight * aspectRatio;

      // Return the dimensions instead of setting them in separate arrays
      return {
        width: calculatedWidth,
        height: fixedHeight,
      };
    } catch (error) {
      console.error("Error calculating image size:", error);
      return {
        width: 180,
        height: 240,
      };
    }
  };

  // Add a new handler for drag
  const handleDrag = useCallback((markerId, newCoords) => {
    setMarkers((prev) =>
      prev.map((marker) =>
        marker.id === markerId ? { ...marker, coordinates: newCoords } : marker
      )
    );
    updateLines();
  }, []);

  // Update map click handler to deactivate all markers
  const handleMapClick = useCallback((e) => {
    if (
      e.target === e.currentTarget ||
      e.target.classList.contains("mapboxgl-canvas")
    ) {
      setMarkers((prev) =>
        prev.map((marker) => ({ ...marker, isActive: false }))
      );
      setSelectedDotId(null);
    }
  }, []);

  const handleLocationFormClose = () => {
    setShowLocationForm(false);
    setCurrentImageWithoutLocation(null);
  };

  return (
    <div
      className="flex flex-col items-center"
      style={{ backgroundColor: "#f5f5dc" }}
    >
      <div className="w-full flex justify-center mb-4 pt-4">
        <UploadPicturesButton onUpload={handleUpload} />
      </div>
      <div
        className="flex flex-col items-center"
        style={{ padding: "0 50px 50px 50px" }}
      >
        <div className="w-full flex justify-center">
          <div
            ref={mapContainer}
            style={{ width: "900px", height: "1260px", position: "relative" }}
            className="relative mb-4"
            onClick={handleMapClick}
          >
            {markers.map((marker) => (
              <ImageMarker
                key={marker.id}
                image={marker}
                style={{ width: marker.width, height: marker.height }}
                isActive={marker.isActive}
                onClick={handleMarkerClick}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                onRemove={handleRemoveImageMarker}
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
                  mapRef={map}
                  onRemove={handleRemoveRedDotMarker}
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
            <MapTextSection
              headlineText={headlineText}
              dividerText={dividerText}
              taglineText={taglineText}
            />
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
        <TransmitDataButton
          map={map}
          redDots={redDots}
          markers={markers}
          headlineText={headlineText}
          dividerText={dividerText}
          taglineText={taglineText}
        />
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

      {showLocationForm && (
        <LocationForm
          onSubmit={handleLocationSubmit}
          onClose={handleLocationFormClose}
          image={currentImageWithoutLocation}
        />
      )}
    </div>
  );
};

export default LiveEditor;
