// pages/User/Discover/Discover.jsx
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import styles from "./Discover.module.css";
import DiscoverHeader from "../../../components/Tourist/Discover/DiscoverHeader/DiscoverHeader";
import CategoryTabs from "../../../components/Tourist/Discover/CategoryTabs/CategoryTabs";

import ExploreSection from "../../../components/Tourist/Discover/ExploreSection/ExploreSection";
import ToursSection from "../../../components/Tourist/Discover/ToursSection/ToursSection";

function Discover() {
    const [searchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

    const query = searchParams.get("search") || "";
    const [previousQuery, setPreviousQuery] = useState(query);
    if (previousQuery !== query) { setPreviousQuery(query); setSearchQuery(query); }

    return (
        <div className={styles.discoverPage}>
            <DiscoverHeader searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}/>

            {searchQuery.trim() && (
                <p className={styles.searchStatus}>
                    Searching for: <span className="font-semibold text-[#003D5B]">{searchQuery}</span>
                </p>
            )}
            <CategoryTabs/>
            {/* <ExploreCard/> */}
            <ExploreSection searchQuery={searchQuery}/>

            <ToursSection
                searchQuery={searchQuery}
            />
        </div>
    );
}

export default Discover;