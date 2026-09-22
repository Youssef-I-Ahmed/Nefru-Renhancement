


import { FaRegHeart } from "react-icons/fa";

import styles from './Cards.module.css'

import image from '../../../assets/images/auth/traveler.jpg'

function Card({options}) {
    return (
    <>
    <div className={styles.container}>
    {options.map((item,index) => {
      return (
        <div key={index} className={styles.card}>
          <div className={styles.image}>
            <img src={item.image} />
          </div>
          <div className={styles.overlay}>
              {item.tag ? (<p className={styles.tag}>{item.tag}</p>) : <></>}
              <p>{item.location}</p>
              <p>{item.type}</p>
          </div>
        </div>
      );
    })}
    </div>
    </>
  )
}

function CardStrip() {
    return (
    <>
      <div className={styles.container_strip}>
        <div className={styles.strip}>
          <div className={styles.strip_image}>
            <img src={image} />
          </div>
          <div className={styles.strip_label}>
            <p>The Royal Retreat</p>
            <p>Maldives</p>
            <p><span>$2,200</span> / night</p>
          </div>
          <div className={styles.strip_save}>
            <FaRegHeart />
          </div>
        </div>
        <div className={styles.strip}>
          <div className={styles.strip_image}>
            <img src={image} />
          </div>
          <div className={styles.strip_label}>
            <p>The Royal Retreat</p>
            <p>Maldives</p>
            <p><span>$2,200</span> / night</p>
          </div>
          <div className={styles.strip_save}>
            <FaRegHeart />
          </div>
        </div>
        <div className={styles.strip}>
          <div className={styles.strip_image}>
            <img src={image} />
          </div>
          <div className={styles.strip_label}>
            <p>The Royal Retreat</p>
            <p>Maldives</p>
            <p><span>$2,200</span> / night</p>
          </div>
          <div className={styles.strip_save}>
            <FaRegHeart />
          </div>
        </div>
        <div className={styles.strip}>
          <div className={styles.strip_image}>
            <img src={image} />
          </div>
          <div className={styles.strip_label}>
            <p>The Royal Retreat</p>
            <p>Maldives</p>
            <p><span>$2,200</span> / night</p>
          </div>
          <div className={styles.strip_save}>
            <FaRegHeart />
          </div>
        </div>
      </div>
    </>
  )  
}

export {Card, CardStrip}
