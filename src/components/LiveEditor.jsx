import React, { useRef, useEffect, useState } from "react";
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

const LiveEditor = ({ selectedImages, setSelectedImages }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerRefs = useRef([]); // Reference to each marker DOM element
  const redDotRefs = useRef([]); // Reference to each red dot marker DOM element
  const [activeMarker, setActiveMarker] = useState(null); // Track the active marker
  const [isUIVisible, setIsUIVisible] = useState(true); // Track UI visibility
  const [markerSizesWidth, setMarkerSizesWidth] = useState([]);
  const [markerSizesHeight, setMarkerSizesHeight] = useState([]);
  const [initialMoveablePictureRenderFlag, setInitialMoveabePictureRenderFlag] =
    useState(false);
  const [headlineText, setHeadlineText] = useState("Headline");
  const [dividerText, setDividerText] = useState("Divider");
  const [taglineText, setTaglineText] = useState("Tagline");

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
    markerRefs.current = [];
    images.forEach((image, index) => {
      if (!image.coordinates) return;
      if (!markerSizesWidth[index] || !markerSizesHeight[index]) return;

      const el = document.createElement("div");
      el.className = "custom-marker";
      el.style.backgroundImage = `url(${image.url})`;
      el.style.width = `${markerSizesWidth[index]}px`;
      el.style.height = `${markerSizesHeight[index]}px`;
      el.style.backgroundSize = "cover";
      el.style.borderRadius = "10px";
      el.style.position = "absolute";
      el.style.transition = "width 0.1s, height 0.1s";
      el.style.border = "2px solid black";

      // Event listeners for resizing and interaction
      el.addEventListener("mouseenter", () => {
        el.style.border = "2px solid lightblue";
      });
      el.addEventListener("mouseleave", () => {
        if (activeMarker !== el) {
          el.style.border = "none";
        }
      });

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setActiveMarker(el);
        markerRefs.current.forEach((marker) => {
          if (marker.element !== el) {
            const existingHandles =
              marker.element.querySelectorAll(".resize-handle");
            existingHandles.forEach((handle) => handle.remove());
            marker.element.style.border = "none";
          }
        });

        // Add resize handles to the active marker
        const existingHandles = el.querySelectorAll(".resize-handle");
        existingHandles.forEach((handle) => handle.remove());

        const corners = [
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ];
        corners.forEach((corner) => {
          const cornerHandle = document.createElement("div");
          cornerHandle.className = `resize-handle ${corner}`;
          cornerHandle.style.width = "10px";
          cornerHandle.style.height = "10px";
          cornerHandle.style.backgroundColor = "white";
          cornerHandle.style.position = "absolute";
          cornerHandle.style.cursor = "nwse-resize";
          cornerHandle.style.borderRadius = "6px";
          cornerHandle.style.transition = "background-color 0.2s";

          if (corner.includes("top")) cornerHandle.style.top = "-5px";
          if (corner.includes("bottom")) cornerHandle.style.bottom = "-5px";
          if (corner.includes("left")) cornerHandle.style.left = "-5px";
          if (corner.includes("right")) cornerHandle.style.right = "-5px";
          el.appendChild(cornerHandle);

          cornerHandle.addEventListener("mouseenter", () => {
            cornerHandle.style.backgroundColor = "blue";
          });
          cornerHandle.addEventListener("mouseleave", () => {
            cornerHandle.style.backgroundColor = "white";
          });

          cornerHandle.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startHeight = markerSizesHeight[index];
            const startWidth = markerSizesWidth[index];

            const onMouseMove = (e) => {
              const delta = Math.max(e.clientX - startX, e.clientY - startY);
              const newHeight = Math.max(10, startHeight + delta);
              const newWidth = newHeight * (startWidth / startHeight); // Maintain aspect ratio
              setMarkerSizesHeight((prevHeights) => {
                const updatedHeights = [...prevHeights];
                updatedHeights[index] = newHeight;
                return updatedHeights;
              });
              setMarkerSizesWidth((prevWidths) => {
                const updatedWidths = [...prevWidths];
                updatedWidths[index] = newWidth;
                return updatedWidths;
              });
              el.style.width = `${newWidth}px`;
              el.style.height = `${newHeight}px`;
            };

            const onMouseUp = () => {
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
          });
        });

        const sides = ["top", "right", "bottom", "left"];
        sides.forEach((side) => {
          const sideHandle = document.createElement("div");
          sideHandle.className = `resize-handle ${side}`;
          sideHandle.style.width =
            side === "top" || side === "bottom" ? "20%" : "10px";
          sideHandle.style.height =
            side === "left" || side === "right" ? "20%" : "10px";
          sideHandle.style.backgroundColor = "white";
          sideHandle.style.position = "absolute";
          sideHandle.style.cursor =
            side === "top" || side === "bottom" ? "ns-resize" : "ew-resize";
          sideHandle.style.borderRadius = "4px";
          sideHandle.style.transition = "background-color 0.2s";

          if (side === "top" || side === "bottom") {
            sideHandle.style.left = "40%";
          }
          if (side === "left" || side === "right") {
            sideHandle.style.top = "40%";
          }
          if (side === "top") sideHandle.style.top = "-5px";
          if (side === "bottom") sideHandle.style.bottom = "-5px";
          if (side === "left") sideHandle.style.left = "-5px";
          if (side === "right") sideHandle.style.right = "-5px";
          el.appendChild(sideHandle);

          sideHandle.addEventListener("mouseenter", () => {
            sideHandle.style.backgroundColor = "blue";
          });
          sideHandle.addEventListener("mouseleave", () => {
            sideHandle.style.backgroundColor = "white";
          });

          sideHandle.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = parseInt(el.style.width);
            const startHeight = parseInt(el.style.height);

            const onMouseMove = (e) => {
              let newWidth = startWidth;
              let newHeight = startHeight;
              if (side === "left" || side === "right") {
                newWidth = Math.max(
                  10,
                  startWidth +
                    (side === "right" ? e.clientX - startX : startX - e.clientX)
                );
              } else if (side === "top" || side === "bottom") {
                newHeight = Math.max(
                  10,
                  startHeight +
                    (side === "bottom"
                      ? e.clientY - startY
                      : startY - e.clientY)
                );
              }
              el.style.width = `${newWidth}px`;
              el.style.height = `${newHeight}px`;
            };

            const onMouseUp = () => {
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
          });
        });
      });

      const mapBounds = map.current.getBounds();
      const offsetLng =
        (mapBounds.getNorthEast().lng - image.coordinates[0]) * 0.3;
      const offsetLat =
        (mapBounds.getNorthEast().lat - image.coordinates[1]) * 0.3;

      const pictureMarker = new mapboxgl.Marker({
        element: el,
        draggable: true,
      })
        .setLngLat([
          image.coordinates[0] + offsetLng,
          image.coordinates[1] + offsetLat,
        ]) // Adjust the coordinates to be 10% above and to the right
        .addTo(map.current);

      pictureMarker.on("dragend", () => {
        updateLines();
        const newCoords = pictureMarker.getLngLat();
        setSelectedImages((prevImages) => {
          const updatedImages = [...prevImages];
          updatedImages[index] = {
            ...updatedImages[index],
            coordinates: [newCoords.lng, newCoords.lat],
          };
          return updatedImages;
        });
      });

      markerRefs.current.push({ element: el, marker: pictureMarker });
    });

    // Add event listener to clear handles when clicking outside markers
    document.addEventListener("click", (e) => {
      if (!markerRefs.current.includes(e.target)) {
        setActiveMarker(null);
        markerRefs.current.forEach((marker) => {
          const existingHandles =
            marker.element.querySelectorAll(".resize-handle");
          existingHandles.forEach((handle) => handle.remove());
          marker.element.style.border = "none";
        });
      }
    });
    setInitialMoveabePictureRenderFlag(true);
  };

  const toggleUIVisibility = () => {
    setIsUIVisible((prev) => !prev);
    const elementsToToggle = document.querySelectorAll(
      ".mapboxgl-ctrl, .resize-handle, .mapboxgl-ctrl-button"
    );
    elementsToToggle.forEach((element) => {
      element.style.display = isUIVisible ? "none" : "";
    });
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
    redDotRefs.current = [];

    images.forEach((image, index) => {
      if (!image.coordinates) return;

      const redDotEl = document.createElement("div");
      redDotEl.className = "red-dot-marker";
      const redDotIcon = document.createElement("img");
      redDotIcon.src = "../assets/user-placeable-icons/heart.svg";
      redDotIcon.style.width = "30px";
      redDotIcon.style.height = "30px";
      redDotEl.appendChild(redDotIcon);

      const redDotMarker = new mapboxgl.Marker({
        element: redDotEl,
        draggable: true,
      })
        .setLngLat(image.coordinates)
        .addTo(map.current);

      redDotMarker.on("dragend", () => {
        updateLines();
        const newCoords = redDotMarker.getLngLat();
        setSelectedImages((prevImages) => {
          const updatedImages = [...prevImages];
          updatedImages[index] = {
            ...updatedImages[index],
            coordinates: [newCoords.lng, newCoords.lat],
          };
          return updatedImages;
        });
      });

      redDotRefs.current.push({ element: redDotEl, marker: redDotMarker });
    });
  };

  const addConnectingLines = () => {
    markerRefs.current.forEach((markerRef, index) => {
      const pictureMarker = markerRef.marker;
      const redDotMarker = redDotRefs.current[index]?.marker;
      if (!pictureMarker || !redDotMarker) return;

      const lineId = `line-${index}`;

      const updateLine = () => {
        const closestCorner = getClosestCorner(pictureMarker, redDotMarker);
        const redDotCoords = redDotMarker.getLngLat();

        if (map.current.getSource(lineId)) {
          map.current.getSource(lineId).setData({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                closestCorner,
                [redDotCoords.lng, redDotCoords.lat],
              ],
            },
          });
        } else {
          map.current.addSource(lineId, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  closestCorner,
                  [redDotCoords.lng, redDotCoords.lat],
                ],
              },
            },
          });

          map.current.addLayer({
            id: lineId,
            type: "line",
            source: lineId,
            paint: {
              "line-color": "#000000", // black color
              "line-width": 1,
            },
          });
        }
      };

      updateLine();
    });
  };

  const updateLines = () => {
    markerRefs.current.forEach((markerRef, index) => {
      const pictureMarker = markerRef.marker;
      const redDotMarker = redDotRefs.current[index]?.marker;
      if (!pictureMarker || !redDotMarker) return;

      const lineId = `line-${index}`;
      const closestCorner = getClosestCorner(pictureMarker, redDotMarker);

      const redDotCoords = redDotMarker.getLngLat();

      if (map.current.getSource(lineId)) {
        map.current.getSource(lineId).setData({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [closestCorner, [redDotCoords.lng, redDotCoords.lat]],
          },
        });
      }
    });
  };

  // Not working, needs an update
  const getClosestCorner = (marker, target) => {
    const { lng, lat } = marker.getLngLat();
    const markerElement = marker.getElement();

    // Marker size in pixels (actual image size may be much larger)
    const markerWidth = parseFloat(markerElement.style.width.replace("px", ""));
    const markerHeight = parseFloat(
      markerElement.style.height.replace("px", "")
    );

    // Assuming we need to calculate based on the actual image size relative to the marker
    const imageWidthFactor = 2.5; // Adjust this factor based on how much larger the image is
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
    let minDistance = getDistance(closestCorner, target.getLngLat());

    for (let i = 1; i < corners.length; i++) {
      const distance = getDistance(corners[i], target.getLngLat());
      if (distance < minDistance) {
        closestCorner = corners[i];
        minDistance = distance;
      }
    }

    return closestCorner;
  };

  // Helper to calculate distance
  const getDistance = (pointA, pointB) => {
    const lngDiff = pointA[0] - pointB.lng;
    const latDiff = pointA[1] - pointB.lat;
    return Math.sqrt(lngDiff * lngDiff + latDiff * latDiff);
  };

  // all useEffects
  useEffect(() => {
    initializeMap();
  }, []);

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
          <div
            className="w-full flex flex-col items-center justify-center p-4 z-10"
            style={{
              backgroundColor: "#ffffff",
              height: "calc(100vh / 7)",
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              gap: "10px", // Add gap between elements
              borderTopLeftRadius: "20px", // Add border radius for smooth transition
              borderTopRightRadius: "20px", // Add border radius for smooth transition
              boxShadow: "0 -4px 8px rgba(0, 0, 0, 0.1)", // Add shadow for smooth transition
            }}
          >
            <div
              className="text-center font-bold text-4xl font-sans"
              style={{ textTransform: "uppercase", letterSpacing: "0.1em" }} // Add letter spacing
            >
              {headlineText}
            </div>
            <div
              className="text-center text-2xl font-sans"
              style={{ textTransform: "uppercase", letterSpacing: "0.1em" }} // Add letter spacing
            >
              {dividerText}
            </div>
            <div
              className="text-center text-lg font-sans"
              style={{
                color: "#4a4a4a",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }} // Add letter spacing
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
            border-radius: 2px;
            border: 1px solid lightblue;
            transition: background-color 0.2s;
          }
          .resize-handle:hover {
            background-color: blue;
          }`}
      </style>
    </div>
  );
};

export default LiveEditor;
