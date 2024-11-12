import React from 'react';
import axios from 'axios';

const TransmitDataButton = ({ 
  map, 
  redDots, 
  markers, 
  headlineText, 
  dividerText, 
  taglineText 
}) => {
  const handleTransmit = async () => {
    if (!map.current) return;

    try {
      // Get current map state
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();

      // Prepare data payload
      const mapData = {
        mapState: {
          center: {
            lng: center.lng,
            lat: center.lat
          },
          zoom: zoom,
          style: map.current.getStyle().name
        },
        redDots: redDots.map(dot => ({
          id: dot.id,
          coordinates: dot.coordinates,
          icon: dot.icon
        })),
        imageMarkers: await Promise.all(markers.map(async marker => {
          // Get the marker element to check if it's been cropped/modified
          const markerElement = document.getElementById(marker.id);
          let imageData = null;

          if (markerElement) {
            const img = markerElement.querySelector('img');
            if (img) {
              // Convert image to base64 if needed
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              imageData = canvas.toDataURL('image/jpeg');
            }
          }

          return {
            id: marker.id,
            coordinates: marker.coordinates,
            style: marker.style,
            imageData: imageData
          };
        })),
        textContent: {
          headline: headlineText,
          divider: dividerText,
          tagline: taglineText
        }
      };

      // Send data to server
      const response = await axios.post('/api/save-map', mapData);
      
      if (response.status === 200) {
        console.log('Map data successfully transmitted');
        // You might want to show a success message to the user
        alert('Map data successfully transmitted!');
      }
    } catch (error) {
      console.error('Error transmitting map data:', error);
      alert('Failed to transmit map data. Please try again.');
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