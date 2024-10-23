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

const LiveEditor = ({ selectedImages, setSelectedImages }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [markerSizes, setMarkerSizes] = useState(
    () => selectedImages.map(() => 50) // Initialize sizes for each image
  );
  const markerRefs = useRef([]); // Reference to each marker DOM element
  const [activeMarker, setActiveMarker] = useState(null); // Track the active marker

  // New function to update geotags for images
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
    const { center, zoom } = calculateCenterAndZoom(updatedImages);

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [center.lng, center.lat],
      zoom: zoom,
      preserveDrawingBuffer: true,
    });

    map.current.on("load", () => {
      map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
      map.current.addControl(new mapboxgl.NavigationControl(), "top-left");

      const geojson = {
        type: "FeatureCollection",
        features: updatedImages
          .filter((image) => image.coordinates)
          .map((image) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: image.coordinates,
            },
            properties: {},
          })),
      };

      map.current.addSource("geotag-points", {
        type: "geojson",
        data: geojson,
      });

      map.current.addLayer({
        id: "geotag-points-layer",
        type: "circle",
        source: "geotag-points",
        paint: {
          "circle-radius": 8,
          "circle-color": "#FF0000",
        },
      });
      addDownloadPluginFunctionality();
      addMoveableUserPictures(updatedImages);
    });
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

  const addMoveableUserPictures = (images) => {
    markerRefs.current = [];

    images.forEach((image, index) => {
      if (!image.coordinates) return;

      const el = document.createElement("div");
      el.className = "custom-marker";
      el.style.backgroundImage = `url(${image.url})`;
      el.style.width = `${markerSizes[index]}px`;
      el.style.height = `${markerSizes[index]}px`;
      el.style.backgroundSize = "cover";
      el.style.borderRadius = "10px";
      el.style.position = "absolute";
      el.style.transition = "width 0.1s, height 0.1s";

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
          if (marker !== el) {
            const existingHandles = marker.querySelectorAll(".resize-handle");
            existingHandles.forEach((handle) => handle.remove());
            marker.style.border = "none";
          }
        });

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
          cornerHandle.style.borderRadius = "4px";
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
            const startSize = markerSizes[index];

            const onMouseMove = (e) => {
              const delta = Math.max(e.clientX - startX, e.clientY - startY);
              const newSize = Math.max(10, startSize + delta);
              setMarkerSizes((prevSizes) => {
                const updatedSizes = [...prevSizes];
                updatedSizes[index] = newSize;
                return updatedSizes;
              });
              el.style.width = `${newSize}px`;
              el.style.height = `${newSize}px`;
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

      const marker = new mapboxgl.Marker({
        element: el,
        draggable: true,
      })
        .setLngLat(image.coordinates)
        .addTo(map.current);

      marker.on("dragend", () => {
        const newCoords = marker.getLngLat();
        setSelectedImages((prevImages) => {
          const updatedImages = [...prevImages];
          updatedImages[index] = {
            ...updatedImages[index],
            coordinates: [newCoords.lng, newCoords.lat],
          };
          return updatedImages;
        });
      });

      markerRefs.current.push(el);
    });

    // Add event listener to clear handles when clicking outside markers
    document.addEventListener("click", (e) => {
      if (!markerRefs.current.includes(e.target)) {
        setActiveMarker(null);
        markerRefs.current.forEach((marker) => {
          const existingHandles = marker.querySelectorAll(".resize-handle");
          existingHandles.forEach((handle) => handle.remove());
          marker.style.border = "none";
        });
      }
    });
  };

  useEffect(() => {
    initializeMap();
  }, []);

  const handleDownload = () => {
    if (!map.current) return;

    // Hide UI elements during capture
    const controls = document.querySelectorAll(
      ".mapboxgl-control-container, .resize-handle"
    );
    controls.forEach((control) => (control.style.display = "none"));

    // Use Mapbox GL method to get canvas
    const canvas = map.current.getCanvas();

    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "mapbox_screenshot.png";
        link.click();
        URL.revokeObjectURL(link.href);
      }
    }, "image/png");

    // Restore UI elements after capture
    controls.forEach((control) => (control.style.display = ""));
  };

  return (
    <div
      className="flex flex-col items-center"
      style={{ padding: "50px", backgroundColor: "#f5f5dc" }}
    >
      <div className="w-full flex justify-center">
        <div
          ref={mapContainer}
          style={{ width: "900px", height: "1260px" }}
          className="relative mb-4"
        />
      </div>
      <button
        onClick={handleDownload}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
      >
        Download Map as Image
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
