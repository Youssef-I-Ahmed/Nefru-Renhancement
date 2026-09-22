import styles from './Body.module.css'

import { Chips } from '../../../../../shared/components/chips/Chips'
import { Card, CardStrip } from '../../../../../shared/components/cards/Cards'
import image from '../../../../../assets/images/Hero Card 1.png'

export default function Body(){
    const cards = [
        {image:image,tag:"TOP",location:"Sunsets at Giza",type:"Historical Tours • Guided"},
        {image:image,tag:"TOP CHOICE",location:"Sunsets at Giza",type:"Historical Tours • Guided"},
        {image:image,tag:"TOP CHOICE",location:"Sunsets at Giza",type:"Historical Tours • Guided"},
    ]
    return (
        <>
        <div className={styles.body}>
            <Chips />
            <div className={styles.card_cointainer}>
                <div className={styles.cards}>
                    <div className={styles.label}>
                        <p>Featured Niga Experiences</p>
                        <p>View all</p>
                    </div>
                    <Card options={cards}/>
                </div>
                <div className={styles.trips}>
                    <div className={styles.label}>
                        <p>Top Trips</p>
                        <p>Filter</p>
                    </div>
                    <CardStrip />
                </div>
            </div>
        </div>
        </>
    )
}