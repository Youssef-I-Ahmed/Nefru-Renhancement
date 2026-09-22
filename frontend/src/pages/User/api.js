import { apiRequest } from '../../services/api'


export const getTourById = async (id) => {
    try {
        const data = await apiRequest(`/trips/${id}`)
        return data
    } catch {
        return {
            error: "error reading tour data"
        }
    }
}