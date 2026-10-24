#Scaling the ride lifecycle
The most important part of ZYVO is not ordinary CRUD. It is the concurrent ride lifecycle.

```mermid


flowchart TD
    A[Passenger requests ride] --> B[Validate request]
    B --> C[Create ride: REQUESTED]
    C --> D[Publish outbox event]
    D --> E[Dispatch worker]
    E --> F[Find nearby available riders in Redis GEO]
    F --> G[Rank eligible riders]
    G --> H[Offer ride]
    H --> I{Rider accepts?}
    I -- No / timeout --> F
    I -- Yes --> J[Atomic assignment transaction]
    J --> K{Assignment succeeds?}
    K -- No, already assigned --> F
    K -- Yes --> L[Ride: ACCEPTED]
    L --> M[Notify passenger and rider]
    M --> N[Pickup and trip tracking]
    N --> O[Ride: COMPLETED]
    O --> P[Fare finalization and payment]


```

A. Nearby rider matching
Do not query millions of rider records in PostgreSQL every time a passenger requests a ride.

Instead:
- Store live rider coordinates and availability in Redis GEO.
- Query nearby candidates using GEOSEARCH.
- Filter candidates by online state, vehicle category, service area, and eligibility.
- Rank a bounded candidate set using ETA, distance, and dispatch rules.
- Revalidate the chosen rider in the database before committing the assignment.
Redis GEO supports radius-based and bounding-box searches, distance ordering, and result limits.



B. Race-safe ride assignment
Suppose two passengers request rides at nearly the same time, and the same rider receives both offers.

Your assignment operation must ensure that a rider cannot accept two conflicting active trips. Use an atomic conditional update, suitable database constraints, or a transaction with appropriate row locking.


C. Live rider location
Treat location updates as a separate high-volume data path.
- Receive location updates through the real-time gateway.
- Validate coordinates and authenticated rider identity.
- Update Redis GEO for current rider positions.
- Publish relevant trip updates to authorized subscribers.
- Persist periodic location samples only when required for trip history, disputes, or compliance.
Do not insert every GPS ping into PostgreSQL by default. That can turn a high-frequency stream into unnecessary write amplification and storage growth.