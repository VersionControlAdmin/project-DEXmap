import { Button } from "@/components/ui/button"
import { Download, Eye, Send } from "lucide-react"

export default function Component({ handleDownload, toggleUIVisibility, map, redDots, markers, headlineText, dividerText, taglineText }) {
  return (
    <div className="flex flex-col items-center bg-[#FFFDF9] border border-[#F0E9E0] rounded-lg p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between w-full gap-3">
        <Button
          variant="outline"
          className="w-full sm:w-auto bg-white text-[#6B5840] hover:bg-[#F7F5F0] border-[#E5DED3]"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4 mr-2" />
          Download Map
        </Button>
        <Button
          variant="outline"
          className="w-full sm:w-auto bg-white text-[#6B5840] hover:bg-[#F7F5F0] border-[#E5DED3]"
          onClick={toggleUIVisibility}
        >
          <Eye className="w-4 h-4 mr-2" />
          Toggle UI
        </Button>
        <Button
          variant="default"
          className="w-full sm:w-auto bg-[#FF6600] hover:bg-[#FF8533] text-white"
          onClick={() => {
            // Assuming TransmitDataButton is a custom component that handles the data transmission
            // We're simulating its functionality here
            console.log("Transmitting data:", { map, redDots, markers, headlineText, dividerText, taglineText })
          }}
        >
          <Send className="w-4 h-4 mr-2" />
          Transmit Data
        </Button>
      </div>
    </div>
  )
}