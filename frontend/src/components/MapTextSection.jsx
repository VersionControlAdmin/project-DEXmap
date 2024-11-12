import React from "react";

const MapTextSection = ({ headlineText, dividerText, taglineText }) => {
  return (
    <div
      className="w-full flex flex-col items-center justify-end z-10" // Changed to 'justify-end' for bottom alignment
      style={{
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 8%, rgba(255,255,255,0.9) 20%, rgba(255,255,255,0.9) 30%, rgba(255,255,255,1) 50%, rgba(255,255,255,1) 100%)",
        height: "17%",
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: "20px",
        borderTopRightRadius: "20px",
        paddingBottom: "30px", // Added padding to ensure text is not flush with the very bottom
      }}
    >
      {/* New wrapper div for text content */}
      <div className="flex flex-col items-center gap-5 w-full">
        <div
          className="text-center font-bold text-4xl font-sans"
          style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
        >
          {headlineText}
        </div>
        <div className="flex items-center justify-center w-full">
          <div className="h-[3px] w-[100px] bg-black mx-[50px]"></div>
          <div
            className="text-center text-2xl font-sans"
            style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
          >
            {dividerText}
          </div>
          <div className="h-[3px] w-[100px] bg-black mx-[50px]"></div>
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
  );
};

export default MapTextSection;
