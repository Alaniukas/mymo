interface VideoPhoneProps {
  poster: string;
  src: string;
  className?: string;
}

export function VideoPhone({ poster, src, className = "" }: VideoPhoneProps) {
  return (
    <div
      className={`rounded-[10px] overflow-hidden bg-[#0A0A0A] phone-shadow shrink-0 ${className}`}
    >
      <video
        poster={poster}
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="none"
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}
