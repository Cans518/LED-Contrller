
import socket
import json
import time

UDP_PORT = 8888
BROADCAST_IP = '<broadcast>'

def discover_devices():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(3.0)
    
    msg = json.dumps({"cmd": "discover"}).encode('utf-8')
    
    print(f"Sending discovery broadcast to port {UDP_PORT}...")
    try:
        sock.sendto(msg, (BROADCAST_IP, UDP_PORT))
        print("Listening for responses for 10 seconds...{BROADCAST_IP}")
        
        start_time = time.time()
        while (time.time() - start_time) < 10.0:
            try:
                data, addr = sock.recvfrom(1024)
                print(f"Received from {addr}: {data.decode('utf-8')}")
            except socket.timeout:
                break
        print("Discovery finished.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        sock.close()

if __name__ == "__main__":
    discover_devices()
