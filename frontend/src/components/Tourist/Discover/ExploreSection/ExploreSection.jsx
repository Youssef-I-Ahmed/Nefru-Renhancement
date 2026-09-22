import styles from "./ExploreSection.module.css";

import ExploreCard from "../ExploreCard/ExploreCard";


import pyramidsImage from "../../../../assets/images/explore/pyramids.jpg";
import khanImage from "../../../../assets/images/explore/khan-el-khalili.jpg";
import oldCairoImage from "../../../../assets/images/explore/old-cairo.jpg";

function ExploreSection({ searchQuery }) {

    const blogs = [

        {
            id: 1,
            title: "The Great Pyramids",
            readTime: "5 min read",
            image : pyramidsImage,
            tags: ["Historical", "Entertaining"],

        },

        {
            id: 2,
            title: "Discover Khan El Khalili",
            readTime: "3 min read",
            image : khanImage,
            tags: ["Historical", "Cultural"],
        },

        {
            id: 3,
            title: "Explore Old Cairo",
            readTime: "4 min read",
            image : oldCairoImage,
            tags: ["Shopping", "Entertaining"],

        },

    ];



    const filteredBlogs = blogs.filter((blog) =>
    blog.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
);

    return (

        <section className={styles.section}>
 
            <div className={styles.header}>

                <h2>Explore Egypt</h2>

                <button className={styles.seeAll}>
                    See All
                </button>

            </div>

            <div className={styles.blogs}>

                {filteredBlogs.map((blog) => (

                    <ExploreCard
                        key={blog.id}
                        blog={blog}
                    />

                ))}

                {filteredBlogs.length === 0 && (

                    <p>
                        No Trip or Program found.
                    </p>

                    )}

            </div>

        </section>

    );
}

export default ExploreSection;