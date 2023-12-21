"use client"
import React, { useEffect, useCallback, useContext, useState, useRef } from "react";
import { MyContext } from "../../../context/SocketProvider";
import Swal from 'sweetalert2';
import { useRouter } from "next/navigation";
import WaitLoading from "@/components/WaitLoading";

export default function page({ params }) {
    const { roomId } = params;
    const user1VideoRef = useRef(null);
    const user2VideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const [Mystream, setMystream] = useState(null);
    const Context = useContext(MyContext);
    const { socket, remoteUuid, setremoteUuid, MyUuid } = Context;
    const router = useRouter();

    // =============================== Init ===============================
    const init = async () => {
        return new Promise(async (resolve, reject) => {
            try {
                const pc = new RTCPeerConnection();
                peerConnectionRef.current = pc;
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                user1VideoRef.current.srcObject = stream;
                setMystream(stream);
                const remoteStream = new MediaStream();
                user2VideoRef.current.srcObject = remoteStream;

                stream.getTracks().forEach((track) => {
                    pc.addTrack(track, stream);
                });

                pc.ontrack = (event) => {
                    event.streams[0].getTracks().forEach((track) => {
                        remoteStream.addTrack(track);
                    });
                };
                resolve("ok");
            } catch (error) {
                console.log("Error : " + error);
                reject(error);
            }
        });
    };

    // =========================== Create Offer ===========================
    const createOffer = async (id) => {
        console.log("Create Offer");
        let run = false;
        peerConnectionRef.current.onicecandidate = async (event) => {
            if (event.candidate) {
                const Offer = JSON.stringify(peerConnectionRef.current.localDescription);
                if (!run) {
                    socket.emit('Send_Offer', { to: id, from: MyUuid, Offer });
                    run = true;
                }
            }
        };
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
    };

    // =========================== Create Answer ===========================
    const createAnswer = useCallback(async ({ to, from, Offer }) => {
        if (to == MyUuid) {
            console.log("Create Ans");
            const receivedOffer = JSON.parse(Offer);
            let run = false;
            peerConnectionRef.current.onicecandidate = async (event) => {
                if (event.candidate) {
                    if (!run) {
                        const Ans = JSON.stringify(peerConnectionRef.current.localDescription);
                        socket.emit('Send_Ans', { to: from, from: to, Ans });
                        run = true;
                    }
                }
            };
            await peerConnectionRef.current.setRemoteDescription(receivedOffer);
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
        }
    }, []);

    // =========================== Add Answer ===========================
    const addAnswer = useCallback(async ({ to, Ans }) => {
        if (to == MyUuid) {
            console.log("Add Ans");
            const receivedAnswer = JSON.parse(Ans);
            if (!peerConnectionRef.current.remoteDescription) {
                peerConnectionRef.current.setRemoteDescription(receivedAnswer);
            }
        }
    }, []);

    const UserJoin = async ({ to, remote }) => {
        if (to == MyUuid) {
            setremoteUuid(remote);
            console.log("My uuid : " + to);
            console.log("Remote uuid : " + remote);
            Start(remote);
        }
    }

    const Get_Available = useCallback(async ({ from, roomCode }) => {
        if (from != MyUuid && roomCode == roomId) {
            socket.emit("Send_Available", { roomCode: roomId, to: from, uuid: MyUuid });
        }
    }, []);

    useEffect(() => {
        socket.emit("Send_RoomJoin_Req", { roomCode: roomId, uuid: MyUuid });

        socket.on("Get_Available", Get_Available);

        socket.on("User_Join", UserJoin);
        socket.on("Get_Offer", createAnswer);
        socket.on("Get_Ans", addAnswer);
        socket.on("EndStream", ({ to }) => {

            if (to == MyUuid) {
                setMystream(null);
                user1VideoRef.current = null;
                user2VideoRef.current = null;
                setremoteUuid(null);
                Swal.fire({
                    icon: "error",
                    title: "Call End",
                    text: "Call End",
                });
                router.push('/');
            }
        });
        return () => {
            socket.off("Get_Available", Get_Available);
            socket.off("User_Join", UserJoin);
            socket.off("Get_Offer", createAnswer);
            socket.off("Get_Ans", addAnswer);
            socket.off("EndStream");
        }
    }, [socket]);


    const Start = async (remote) => {
        // console.log("Start Run");
        await init();
        const string1 = MyUuid;
        const string2 = remote;

        const result = string1.localeCompare(string2);

        if (result < 0) {
            createOffer(remote);
        }
    }

    const endStream = async (id) => {
        // const tracks = Mystream.getTracks();
        // tracks.forEach((track) => {
        //     track.stop();
        // });

        setMystream(null);
        user1VideoRef.current = null;
        user2VideoRef.current = null;
        socket.emit("EndStream", { to: id });
        setremoteUuid(null);
        router.push('/');
    }

    // ========================================================================

    return (
        <>
            {remoteUuid &&
                <>
                    <div className='absolute w-screen h-screen'>
                        <video className="w-full h-screen p-5" style={{ transform: 'scaleX(-1)' }} ref={user2VideoRef} autoPlay playsInline />
                    </div>

                    <div className='absolute bottom-0 right-0'>
                        <video className="sm:w-48 w-32 sm:h-72 h-48 p-5" style={{ transform: 'scaleX(-1)' }} ref={user1VideoRef} autoPlay muted playsInline />
                    </div>

                    <div className='absolute bottom-0 right-0'>
                        <button type="button" className="text-white bg-gradient-to-r from-red-400 via-red-500 to-red-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-red-300 dark:focus:ring-red-800 shadow-lg shadow-red-500/50 dark:shadow-lg dark:shadow-red-800/80 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2" onClick={() => { endStream(remoteUuid) }}>End</button>
                    </div>
                </>
            }
            {!remoteUuid && (
                <WaitLoading />
            )}

        </>
    )
}