ARCHITECURE NOTES :

- engine state is in memory to keep it fast - snapshot + input stream replay keeps engine reliable and deterministic on restart - persistent db poller event stream keeps db state deterministic on dp poller restart - systems are kept idempotent to safely deal with at-least once delivery - engine is kept single threaded for now - persistent single input stream is kept as the source of truth - balances, orderbook and positions stay in engine, fills and orders stay in db - ws server allows direct requests to engine and subscriptions for updates - http server handles db requests
  ![Screenshot](architecture.svg)
