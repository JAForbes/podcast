Unless: Architecture
=================

> Do not communicate by sharing memory; instead, share memory by communicating.

Effective Go

> Stick your state in a process, and don't let anybody outside see it. Access the state through messages with a well defined protocol.

Joe Armstrong (Creator of Erlang)


> Grid Layout lets us properly separate the order of elements in the source from their visual presentation. As a designer this means you are free to change the location of page elements as is best for your layout at different breakpoints and not need to compromise a sensible structured document for your responsive design.

Rachel Andrew ( Core Contributor to CSS Grid Specification )

What
----

Maybe we've been doing it all wrong!?  It's a little disappointing - but also exciting!

What have we been doing wrong?  We've been treating frontend architectures differently.  We think of UI's as a series of nested components encapsulating state and presentation logic.  But maybe our application should be completely _flat_.

Even if semantically it seems logical to nest, to indicate a logical heirarchy.  But the problem with heirarchies is: they're easy to construct, but hard to re-order.

But what if our app is just a stream of changes we can tap into and extend unidirectionally?  And we can decide *where* the component operates and *where* it is visually represented in completely isolation to how its structured in the file and module system.

That sounds great, but isn't it cumbersome to traverse those existing structures to inject components after the fact?

Well we need a few tools in our arsenal to make this feasible.

- Queries
- Streams
- Union Types

Queries allow us to retrospectively inject logic and representation into their respective heirarchies easily.

Streams allow us to pass _relationships by reference_ - avoiding a lot of spaghetti code trying to keep the world in sync with itself.

Union Types encode how different components talk to eachother.  We'll never accept malformed data, we'll learn from Erlang and gracefully reboot our system when we encounter unexpected errors.

We don't need to completely understand this structures in order to create a real world app.  The key take away is:

Treat components as Servers
----------------------------

- We can't share state, but we can send messages.
- Any two Servers can talk to eachother
- When they talk to eachother there's (hopefully) a well defined protocol (usually a HTTP RESTFul API)

On the backend we don't nest servers.  That doesn't make any sense.  We may only allow particular servers to know the correct protocol to exchange information with eachother, but the servers themselves are all existing on the same flat plane of the network.  Whether or not a server can successfully communicate with every server, they can at least _try_.

It's common to have a single orchestration service that facilitates communication between services.  But that's simply one of many abstractions you can place on top of this model. And it's very powerful.

Scoped Discrimination
---------------------

What if when a component exports its `update`, it is simply composed with other `update`'s into a global `update` function.

When composing, we use queries to ensure the component can only target a part of the model.  And it won't know what that key or path is.

It will traverse a set of actions.  The actions stream is flat, it contains all actions for the entire app, but we want it to be discriminated.

So we get the component update to opt in to discrimination

```js
/**
 * @param { PodcastModel } model
 * @param { PodcastFeed | any } action
 * @returns { PodcastModel }
 */
function update(model, action){
    if( action.type == PodcastFeed.name ){
        return fold( PodcastFeed )({
            FETCH(){ ... }
            ,PARSE(){ ... }
        }) (action)
    } else {
        return model
    }

}
```


That `model` isn't the global model, its a subsection of it that has been determined by the orchestrator.  The component chooses what unions to discriminate and how that affects it's model.

Contrast this with Redux where we appear to do something very similar, but in Redux there's no discrimination.  We handle types, but if we miss a case - there's no error.

We can take advantage of existing abstractions for this pattern like ramda's `R.unless` which accepts a predicate, if the predicate returns true, the second function is called, if the predicate returns false, the 2nd visitor function is called.  There's also `R.when`, but in the interest of not forgetting to return the model when its a different type of action I prefer `unless` is this case:

```js
const ActionIs = type => action => type.name == action.type

const update = model => unless ( ActionIs(PodcastFeed) ) 
    () => model
    ,( fold(PodcastFeed)({
        ...
    }) )
})
```


This is far less error prone and in my opinion _almost looks native_ .

But we still have the power to opt out of this system for tooling: we've still got a single global unscoped action stream.

Podcast Example
---------------

We're going to build an app to explore this idea.
Every component will be injected from the entry point to the app.  The entry point will decide where components are placed logically and visually and which data they have access to.

The communication channels between components will be facilitated in one place.  The actual logic for these components will be hidden inside these "servers".

