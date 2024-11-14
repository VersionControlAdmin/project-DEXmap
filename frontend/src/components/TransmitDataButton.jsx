import React from "react";
import axios from "axios";
import { Image, Transformation } from "cloudinary-react";

const TransmitDataButton = ({
  map,
  redDots,
  markers,
  headlineText,
  dividerText,
  taglineText,
}) => {
  const uploadToCloudinary = async (blob) => {
    try {
      const signatureResponse = await axios.get(
        "http://localhost:3000/api/user-image-cloud-signature"
      );

      const { signature, timestamp, cloudName, apiKey, uploadPreset } =
        signatureResponse.data;

      const formData = new FormData();
      formData.append("file", blob);
      formData.append("timestamp", timestamp);
      formData.append("upload_preset", uploadPreset);
      formData.append("signature", signature);
      formData.append("api_key", apiKey);

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return uploadResponse.data.secure_url;
    } catch (error) {
      if (error.response) {
        console.error("Error response:", error.response.data);
      }
      throw error;
    }
  }; 

  const handleTransmit = async () => {
    if (!map.current) return;
    try {
      // Get current map state
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      // Convert blob URLs to base64 data
      // Process markers - upload images to Cloudinary
      const processedMarkers = await Promise.all(
        markers.map(async (marker) => {
          const response = await fetch(marker.url);
          const blob = await response.blob();
          const cloudinaryUrl = await uploadToCloudinary(blob);

          return {
            id: marker.id,
            coordinates: marker.coordinates,
            imageUrl: cloudinaryUrl, // Store Cloudinary URL instead of base64
          };
        })
      );

      // Process red dots
      const processedRedDots = redDots.map((dot) => ({
        id: dot.id,
        coordinates: dot.coordinates,
        icon: dot.icon.split("/").pop(), // Extract filename from path
      }));

      const mapData = {
        mapState: {
          center: {
            lng: center.lng,
            lat: center.lat,
          },
          zoom: zoom,
          style: map.current.getStyle().name,
        },
        redDots: processedRedDots,
        imageMarkers: processedMarkers,
        textContent: {
          headline: headlineText,
          divider: dividerText,
          tagline: taglineText,
        },
      };

      console.log("mapdata", mapData);
      // Send data to server with full URL
      const response = await axios.post(
        "http://localhost:3000/api/projects",
        mapData
      );

      if (response.status === 200) {
        console.log("Map data successfully transmitted");
        // You might want to show a success message to the user
        alert("Map data successfully transmitted!");
      }
    } catch (error) {
      console.error("Error transmitting map data:", error);
      alert("Failed to transmit map data. Please try again.");
    }
  };

  return (
    <button
      onClick={handleTransmit}
      className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-700 transition-colors"
    >
      Transmit Data to Server
    </button>
  );
};

export default TransmitDataButton;
