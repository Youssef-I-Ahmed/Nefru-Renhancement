import "./User.module.css";
import Navbar from './Navbar/Navbar'
import Home from './Home/Home'
import { Routes, Route } from "react-router-dom";
function User(){
    return(<>
        <div className="contrainer">
            <Routes>
                <Route index={true} element={<Home/>}/>
                {/* <Route path="trips" element={<Trips/>}/>
                <Route path="trips/info" element={<Info/>}/>
                <Route path="trips/info/book" element={<Book/>}/>
                <Route path="trips/info/book/status" element={<Status/>}/>
                <Route path="trips/info/guide" element={<Guide/>}/>
                <Route path="saved" element={<Saved/>}/>
                <Route path="profile" element={<Profile/>}/> */}
            </Routes>
            <Navbar/>
        </div>
    </>)
}

export default User;
