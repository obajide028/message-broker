export enum MessageType {

    // Client -> Broker

    PUBLISH = 'PUBLISH',  // producer sending a message
    SUBSCRIBE = 'SUBSCRIBE',  // consumer subscribing to a topic
    UNSUBSCRIBE = 'UNSUBSCRIBE',  //consumer leaving a topic
    ACKNOWLEDGE = 'ACKNOWLEDGE',  // consumer confirming receipt of a message

    // Broker -> Client
    DELIVER = 'DELIVER',  // broker pushing message to consumer


    // Housekeeping
    PING = 'PING',  
    PONG = 'PONG',
    ERROR = 'ERROR',  // broker sending error message to client

}

export enum DeliveryMode {
  FANOUT = 'FANOUT',     // every subscriber gets a copy (pub/sub)
  ROUND_ROBIN = 'ROUND_ROBIN', // one consumer per message (queue / work distribution)
}

export enum MessageStatus {
  PENDING = 'PENDING',       // sitting in broker, not yet delivered
  DELIVERED = 'DELIVERED',   // sent to consumer, waiting for ack
  ACKNOWLEDGED = 'ACKNOWLEDGED', // consumer confirmed receipt
  FAILED = 'FAILED',         // delivery failed after retries
  EXPIRED = 'EXPIRED',       // TTL passed before delivery
}