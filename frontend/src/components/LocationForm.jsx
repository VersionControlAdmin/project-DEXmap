"use client";

import React, { useState, useEffect, useRef } from "react";
import { XIcon } from "lucide-react";

const googleCloudPlaceToken = import.meta.env.VITE_GOOGLE_CLOUD_PLACE_TOKEN;
// Move the function outside the component
const loadGoogleMapsScript = (callback) => {
  if (
    typeof window.google === "object" &&
    typeof window.google.maps === "object"
  ) {
    callback();
  } else {
    const googleMapScript = document.createElement("script");
    googleMapScript.src = `https://maps.googleapis.com/maps/api/js?key=${googleCloudPlaceToken}&libraries=places`;
    window.document.body.appendChild(googleMapScript);
    googleMapScript.addEventListener("load", callback);
  }
};

export default function LocationForm({ onSubmit, onClose, image }) {
  const [location, setLocation] = useState("");
  const [isValidLocation, setIsValidLocation] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValidLocation || !selectedPlace) return;

    const locationData = {
      address: selectedPlace.formatted_address,
      lat: selectedPlace.geometry.location.lat(),
      lng: selectedPlace.geometry.location.lng(),
    };
    onSubmit(locationData);
  };

  useEffect(() => {
    loadGoogleMapsScript(() => {
      if (inputRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          {
            types: ["geocode"],
          }
        );
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            setIsValidLocation(true);
            setLocation(place.formatted_address);
            setSelectedPlace(place);
          }
        });
      }
    });
  }, []);

  // Add handler to reset validation when input changes
  const handleInputChange = (e) => {
    setLocation(e.target.value);
    setIsValidLocation(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Add Location</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors duration-200"
            aria-label="Close dialog"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">
              Please type and select the location of your image below. You can
              adjust or move the image later if needed.
            </p>
            {image && (
              <div className="mb-4 flex justify-center">
                <img
                  src={image.url}
                  alt="Image without location"
                  className="max-h-48 object-contain rounded-lg shadow-md"
                />
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter a location"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={location}
              onChange={handleInputChange}
              required
            />
          </div>
          <button
            type="submit"
            className={`w-full py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isValidLocation
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            disabled={!isValidLocation}
          >
            {isValidLocation ? "Submit" : "Please select location"}
          </button>
        </form>
      </div>
    </div>
  );
}
