import { useState } from "react";
import Style from "./Counter.module.css";

export default function Counter({
  min = 0,
  max = 99,
  initialValue = 0,
  onChange,
}) {
  const [count, setCount] = useState(initialValue);

  const increment = () => {
    if (count >= max) return;
    const next = count + 1;
    setCount(next);
    onChange?.(next);
  };

  const decrement = () => {
    if (count <= min) return;
    const next = count - 1;
    setCount(next);
    onChange?.(next);
  };

  return (
    <div className={Style.counter}>
      <button className={Style.btn} onClick={decrement} disabled={count <= min}>
        −
      </button>
      <span className={Style.value}>{count}</span>
      <button
        className={`${Style.btn} ${Style.btnActive}`}
        onClick={increment}
        disabled={count >= max}
      >
        +
      </button>
    </div>
  );
}
