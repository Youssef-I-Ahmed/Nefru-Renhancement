import { useNavigate } from "react-router-dom";

import Icons from "../../../assets/icons";
import styles from "./AuthBackButton.module.css";

export default function AuthBackButton({ to = -1, label = "Go back" }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof to === "number") {
      navigate(to);
      return;
    }

    navigate(to);
  };

  return (
    <button
      type="button"
      className={styles.backButton}
      onClick={handleBack}
      aria-label={label}
      title={label}
    >
      <Icons.back />
    </button>
  );
}
