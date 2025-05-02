import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { HealthDataType } from './use-health-platforms';

interface HealthWebSocketOptions {
  careRecipientId?: number;
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
}

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useHealthWebSocket({
  careRecipientId,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  autoReconnect = true,
}: HealthWebSocketOptions = {}) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Setup WebSocket connection
  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    
    // Close any existing socket
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    setStatus('connecting');
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.onopen = () => {
        setStatus('connected');
        if (onConnect) onConnect();
        
        // Subscribe to health data updates for the specific care recipient
        if (careRecipientId) {
          socket.send(JSON.stringify({
            type: 'subscribe',
            careRecipientId,
          }));
        }
        
        // Clear any reconnect timeout
        if (reconnectTimeoutRef.current !== null) {
          window.clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
      
      socket.onclose = () => {
        setStatus('disconnected');
        if (onDisconnect) onDisconnect();
        
        // Auto reconnect if enabled
        if (autoReconnect && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 5000);
        }
      };
      
      socket.onerror = (error) => {
        setStatus('error');
        if (onError) onError(error);
        
        toast({
          title: "WebSocket Error",
          description: "Connection to health data server interrupted. Reconnecting...",
          variant: "destructive",
        });
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          
          // Handle different message types
          if (data.type === 'update' && data.dataType) {
            // Invalidate relevant query data based on the update type
            if (data.dataType === 'sleep') {
              queryClient.invalidateQueries({ queryKey: ['/api/sleep'] });
            } else if (data.dataType === 'bloodPressure') {
              queryClient.invalidateQueries({ queryKey: ['/api/blood-pressure'] });
            } else if (data.dataType === 'glucose') {
              queryClient.invalidateQueries({ queryKey: ['/api/glucose'] });
            }
            
            toast({
              title: "Health Data Updated",
              description: `New ${data.dataType} data received from your health platform`,
            });
          }
          
          if (onMessage) onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message', error);
        }
      };
    } catch (error) {
      setStatus('error');
      console.error('WebSocket connection error:', error);
      
      // Auto reconnect if enabled
      if (autoReconnect && !reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 5000);
      }
    }
  }, [careRecipientId, onConnect, onDisconnect, onError, onMessage, autoReconnect, toast, queryClient]);
  
  // Disconnect WebSocket connection
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setStatus('disconnected');
  }, []);
  
  // Send message through WebSocket
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  // Effect to connect/disconnect based on component lifecycle
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  // Effect to handle care recipient changes
  useEffect(() => {
    if (status === 'connected' && careRecipientId && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: 'subscribe',
        careRecipientId,
      }));
    }
  }, [careRecipientId, status]);
  
  return {
    status,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
    isConnected: status === 'connected',
  };
}