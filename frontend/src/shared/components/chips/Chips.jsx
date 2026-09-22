import { useState } from "react";
import styles from "./Chips.module.css";
import { FaWalking } from "react-icons/fa";

function Chips({ data }) {
  const [value, setValue] = useState("walking");

  const options = data || [
    { label: "Walking", value: "walking" },
    { label: "Running", value: "running" },
    { label: "Cycling", value: "cycling" },
  ];

  return (
    <div className={styles.container}>
      {options.map((item) => {
        const isActive = value === item.value;

        return (
          <div
            key={item.value}
            className={`${styles.chip} ${isActive ? styles.active : ""}`}
            onClick={() => setValue(item.value)}
          >
            <FaWalking className={styles.icon} />
            <p>{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export { Chips };