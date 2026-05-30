import { Marquee } from "@/components/ui/marquee";

const videos = [
  { poster: "/videos/posters/landing-compare-1.jpg", src: "/videos/landing-compare-1.mp4" },
  { poster: "/videos/posters/infinite-scroll-1.jpg", src: "/videos/infinite-scroll-1.mp4" },
  { poster: "/videos/posters/landing-compare-2.jpg", src: "/videos/landing-compare-2.mp4" },
  { poster: "/videos/posters/infinite-scroll-2.jpg", src: "/videos/infinite-scroll-2.mp4" },
  { poster: "/videos/posters/landing-compare-3.jpg", src: "/videos/landing-compare-3.mp4" },
  { poster: "/videos/posters/infinite-scroll-3.jpg", src: "/videos/infinite-scroll-3.mp4" },
  { poster: "/videos/posters/gallery-1.jpg", src: "/videos/gallery-1.mp4" },
];

export function PricingVideoMarquee() {
  return (
    <div className="mt-4 overflow-hidden">
      <div className="overflow-hidden py-10 px-2">
        <Marquee pauseOnHover duration="50s" gap="1rem">
          {videos.map((video) => (
            <div
              key={video.src}
              className="w-[120px] h-[213px] sm:w-[160px] sm:h-[284px] rounded-[10px] overflow-hidden shrink-0 bg-[#0A0A0A] phone-shadow"
            >
              <video
                poster={video.poster}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                preload="none"
              >
                <source src={video.src} type="video/mp4" />
              </video>
            </div>
          ))}
        </Marquee>
      </div>
    </div>
  );
}
