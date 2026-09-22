import styles from "./CategoryTabs.module.css";

import { IoWalkOutline } from "react-icons/io5";
import { LuLandmark , LuUtensils } from "react-icons/lu";

import { useState } from "react";

function CategoryTabs() {
const [activeCategory, setActiveCategory] = useState("Walking");
    
const categories = [
        { id: 1, name: "Walking", icon: IoWalkOutline  },
        { id: 2, name: "History", icon: LuLandmark  },
        { id: 3, name: "Food", icon: LuUtensils  }
    ];

    return (
        <div className={styles.container}>
        {categories.map((category) => {
            const Icon = category.icon;
            return (
                <button key={category.id} className={`${styles.button} ${activeCategory === category.name ? styles.active : ''}`}
                    onClick={() => setActiveCategory(category.name)}
>
                    <Icon className={styles.icon} />
                    <span>{category.name}</span>
                </button>
            );
        })}
        </div>
    );
}

export default CategoryTabs;