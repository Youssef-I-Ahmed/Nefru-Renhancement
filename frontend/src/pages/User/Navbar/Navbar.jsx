import styles from './Navbar.module.css'

import {Link} from 'react-router-dom'
import {ButtonIcon} from '../../../shared/components/Button/Button'
import { GoHome } from "react-icons/go";
export default function Navbar(){
    return (
    <>
        <div className={styles.container}>
            <Link to="/user/home"><ButtonIcon><GoHome /></ButtonIcon></Link>
            <Link to="/user/trips"><ButtonIcon><GoHome /></ButtonIcon></Link>
            <Link to="/user/saved"><ButtonIcon><GoHome /></ButtonIcon></Link>
            <Link to="/user/profile"><ButtonIcon><GoHome /></ButtonIcon></Link>
        </div>
    </>
    )
}
