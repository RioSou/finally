"use client";

import { useEffect, useRef, useState } from "react";

interface PriceFlashProps {
  price: number;
  direction: "up" | "down" | "flat";
  children: React.ReactNode;
}

export default function PriceFlash({ price, direction, children }: PriceFlashProps) {
  const [flashClass, setFlashClass] = useState("");
  const prevPriceRef = useRef(price);

  useEffect(() => {
    if (prevPriceRef.current !== price && direction !== "flat") {
      setFlashClass(direction === "up" ? "price-flash-up" : "price-flash-down");

      const timer = setTimeout(() => setFlashClass(""), 500);
      prevPriceRef.current = price;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = price;
  }, [price, direction]);

  return (
    <span className={`rounded px-1 ${flashClass}`}>
      {children}
    </span>
  );
}
