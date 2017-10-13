const m = require('mithril')
const stream = require('mithril/stream')
const sst = require('static-sum-type/configs/dev/foldThrow.js')
const predicated = require('static-sum-type/modules/predicated/dev')
const T = require('sanctuary-def')
const toString = require('ramda/src/toString')
const $ = require('hickery/configs/mithril-immutable')
const equals = require('ramda/src/equals')

const Predicated = predicated(toString, e => {
    // todo-james create a config in sst
    // todo-james handle non sst errors as part of sst error type: ErrUnknown?
    if( 'type' in e && e.type == 'StaticSumTypeError'){
        // eslint-disable-next-line fp/no-throw
        throw new TypeError( sst.errMessage(e) )
    } else {
        // eslint-disable-next-line fp/no-throw
        throw new TypeError(e.message)
    }
})

const Model =
    Predicated('Feed', {
        URL: T.test([], T.RecordType({
            url: T.String
        }))
        ,Loaded: T.test([], T.RecordType({
            url: T.String
            ,originalURL: T.String
            ,xml: T.String
        }))
        ,Parsed: T.test([], T.RecordType({
            url: T.String
            ,originalURL: T.String
            ,parsed: T.Any
        }))
    })


const Action = Predicated('Action', {
    URL: T.test([], T.String)
    ,FETCH: T.test([], T.Any)
    ,PARSE: T.test([], T.Any) 
})

const Feed$getEditableURL = 
    sst.fold( Model )({
        URL: x => x.url
        ,Loaded: x => x.url
        ,Parsed: x => x.url
    })

function FeedComponent(read$, write){
        
    function update(p, n){

        return sst.fold( Action ) ({
            URL(){
                return Model.URL(n.value)
            }
            ,FETCH(){
                return p
            }
            ,PARSE(){
                return p
            }
        }) ( n )
    }

    function DOMSideEffects(p, n){
        
        // eslint-disable-next-line fp/no-mutation, no-undef
        window.state = p
    
        return sst.fold( Action ) ({
            URL(){}
            ,FETCH(){
    
                m.request({
                    url: 'https://cors.now.sh/'+p.value.url
                    ,deserialize: i => i
                    ,method: 'GET'
                })
                    .then(function(response){
                        
                        // eslint-disable-next-line fp/no-mutation
                        Object.assign(p, Model.Loaded({
                            xml: response
                            ,url: p.value.url 
                            ,originalURL: p.value.url 
                        }))
    
                        write( Action.PARSE() )
                    })
            }
            ,PARSE(){
    
                // eslint-disable-next-line no-undef
                const xml = new DOMParser().parseFromString(
                    p.value.xml
                        .replace(/itunes:/g, 'itunes_')
                    , 'application/xml'
                )
            
                const defaultNode = { innerHTML: '', getAttribute: () => '' } 
                const xmlItems = Array.from(xml.querySelectorAll('item'))
            
                const xmlChannel = xml.querySelector('channel')
                
                const channel = {
                    title: 
                        ( xmlChannel.querySelector('title') 
                            || defaultNode
                        ).innerHTML
                    
                    ,link: 
                        ( xmlChannel.querySelector('link') 
                            || defaultNode
                        ).innerHTML
                    
                    ,language: 
                        ( xmlChannel.querySelector('language') 
                            || defaultNode
                        ).innerHTML
                    
                    ,copyright: 
                        ( xmlChannel.querySelector('copyright') 
                            || defaultNode
                        ).innerHTML
                    
                    ,description: 
                        ( xmlChannel.querySelector('description') 
                            || defaultNode
                        ).innerHTML
                    
                    ,itunesType: 
                        ( xmlChannel.querySelector('itunes_type') 
                            || defaultNode
                        ).innerHTML
                    
                    ,itunesImageHref: 
                        ( xmlChannel.querySelector('itunes_image') 
                            || defaultNode
                        ).getAttribute('href')
                    
                    ,items:
                        xmlItems.map(function(xml){
                            return {
                                title: 
                                    (xml.querySelector('title') 
                                    || defaultNode
                                    ).innerHTML
                                ,itunesSubtitle: 
                                    (xml.querySelector('itunes_subtitle') 
                                    || defaultNode
                                    ).innerHTML
                                ,description: 
                                    (xml.querySelector('description') 
                                    || defaultNode
                                    ).innerHTML
                                ,pubDate: 
                                    (xml.querySelector('pubDate') 
                                    || defaultNode
                                    ).innerHTML
                                ,itunesAuthor: 
                                    (xml.querySelector('itunes_author') 
                                    || defaultNode
                                    ).innerHTML
                                ,itunesTitle: 
                                    (xml.querySelector('itunes_title') 
                                    || defaultNode
                                    ).innerHTML
                                ,itunesDuration: 
                                    (xml.querySelector('itunes_duration') 
                                    || defaultNode
                                    ).innerHTML
                                ,itunesExplicit: 
                                    (xml.querySelector('itunes_explicit') 
                                    || defaultNode
                                    ).innerHTML
                                ,enclosure: {
                                    type: 
                                        (xml.querySelector('enclosure') 
                                        || defaultNode
                                        ).getAttribute('type')
                                    ,length: 
                                        (xml.querySelector('enclosure') 
                                        || defaultNode
                                        ).getAttribute('length')
                                    ,url: 
                                        (xml.querySelector('enclosure') 
                                        || defaultNode
                                        ).getAttribute('url')
                                }
                            }
                        })
                }
            
                // eslint-disable-next-line fp/no-mutation
                Object.assign(p, Model.Parsed({
                    parsed: channel
                    ,url: p.value.url 
                    ,originalURL: p.value.url 
                }))
            }
        })( n )
    }


    const view = (model) => m(
        'div'
        , m('input'
            , { oninput: 
                m.withAttr('value', function(value){
                    write( Action.URL( value ) )
                })
                ,value: Feed$getEditableURL(model)
            }
        )
        , m('button', {
            onclick(){
                write( Action.FETCH() )
            }
        }, 'Fetch')
        , model.value.parsed
        && [
            m('a', { href: model.value.parsed.link }
                ,m('h1', model.value.parsed.title)
            )
            ,m('img', { 
                src: model.value.parsed.itunesImageHref
                ,style: { maxWidth: '100px' }
            })
            ,m('subheading', model.value.parsed.description)
            ,model.value.parsed.items.map(function(item){
                return [
                    m('heading', item.title)
                    ,m('subheading', item.itunesSubtitle)
                    ,m('p', item.description)
                    ,m('audio'
                        ,{ controls: 'controls'  
                        }
                        ,m('source', {
                            src: item.enclosure.url
                        })
                    )

                ]
            })
            ,m('pre', JSON.stringify(model.value.parsed, null, 2))
        ]
    )


    return {
        effects: {
            DOM: DOMSideEffects
        }
        ,update
        ,view
        ,init: () => 
            Model.URL({
                url: 'https://feeds.feedburner.com/InterceptedWithJeremyScahill'
            })
    }

}

// Create a mounting function that also runs n side effects
function Mount(effects){

    return function mount(query, actions$, Component){
        // local notifcation channel
        const local$ = stream()
    
        // component scoped to that local channel
        const c = Component(local$, local$)
    
        // create the view using components init and update methods
        const view$ = stream.scan(function(p,n){
            // run exposed effects ( if we want to )
            effects.forEach(function(k){
                if(k in c.effects)
                c.effects[k](p,n)
            })
            // generate the view stream
            return c.update(p, n)
        }, c.init(), local$)
            .map( c.view )
    
        // if another component changes our model, push the message
        // into the local stream
        actions$.map(query( (localModel) => {
            if( localModel != null && !equals(localModel, local$() )){
                local$(localModel)
            }
            return null
        }))
        
        // if anything happens in our local stream
        // broadcast it to the rest of the app, but within our model only
        local$.map(function(localModel){
            actions$( query( localModel ) )
            return null
        })
        
        // return the view stream
        // to either be called as a function in a parent view
        // or to be connected to m.render at the root of the app
        return view$
    }
}

const actions$ = stream()
actions$({})

Mount(['DOM']) ($.path(['feed']), actions$, FeedComponent)
    // eslint-disable-next-line no-undef
    .map( x => m.render(document.body, x) )