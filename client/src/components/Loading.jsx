import React, { useEffect } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLocation } from 'react-router-dom';

const Loading = () => {
    const { navigate } = useAppContext();
    const { search } = useLocation()
    const query = new URLSearchParams(search)
    const nextUrl = query.get('next');

    useEffect(() => {
        if (nextUrl) {
            console.log("asf")
            setTimeout(() => {
                navigate(`/${nextUrl}`)
            }, 5000)
        }
    },[nextUrl])

    return (
        <div className='flex justify-center items-center h-screen'>
            <div className='animate-spin rounded-full h-18 w-18 border-2 border-gray-300 border-t-primary'>
            </div>
        </div>
    )
}

export default Loading