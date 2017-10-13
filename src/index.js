const m = require('mithril')
const stream = require('mithril/stream')
const sst = require('static-sum-type/configs/dev/foldThrow.js')
const predicated = require('static-sum-type/modules/predicated/dev')
const T = require('sanctuary-def')
const toString = require('ramda/src/toString')
const $ = require('hickery/configs/mithril-immutable')
const equals = require('ramda/src/equals')

const unless = p => f => g => a => p(a) ? g(a) : f(a)

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

const ActionIs = type => action => {
    return type.name == action.type
}


const FeedInput = {
    init(){
        return () => FeedInput.Model.URL({
            url: ''
        })
    }
    
    ,Model:
        Predicated('FeedInput.Model', {
            URL: T.test([], T.RecordType({
                url: T.String
            }))
            ,Loaded: T.test([], T.RecordType({
                url: T.String
                ,originalURL: T.String
            }))
        })

    ,Action:
        Predicated('FeedInput.Action', {
            URL: T.test([], T.RecordType({
                url: T.String
            }))
            ,FETCH: T.test([], T.Any)
        })

    ,update: () => model => 
        unless( ActionIs(FeedInput.Action) ) ( () => model ) ( 
            sst.fold( FeedInput.Action) ({
                URL({ url }){
                    return FeedInput.Model.URL({ url })
                }
                ,FETCH: () => model
            })
        )

    ,effects: {
        DOM: () => model => 
            unless( ActionIs(FeedInput.Action) ) ( () => model ) (
                sst.fold( FeedInput.Action) ({
                    URL(){}
                    ,FETCH(){
            
                        m.request({
                            url: 'https://cors.now.sh/'+model.value.url
                            ,deserialize: i => i
                            ,method: 'GET'
                        })
                            .then(function(response){
                                
                                // eslint-disable-next-line fp/no-mutation
                                Object.assign(model, FeedInput.Model.Loaded({
                                    url: model.value.url 
                                    ,originalURL: model.value.url 
                                }))
            
                                actions$( Feed.Action.PARSE(response) )
                            })
                    }
                })
            )
            
    }

    ,view: update => model => {
        return m('div'
            ,m('input'
                , { oninput: 
                    m.withAttr('value', function(value){
                        update( FeedInput.Action.URL( value ) )
                    })
                    ,value: model.value.url
                }
            )
            , m('button', {
                onclick(){
                    update( FeedInput.Action.FETCH() )
                }
            }, 'Fetch')
        )   
    }

}

const Feed = {
    init(){
        return () => Feed.Model.Empty()
    }

    ,Model:
        Predicated('Feed.Model', {
            Empty: equals(undefined)
            ,Parsed: T.test([], T.Any)
        })

    ,Action:
        Predicated('Feed.Action', {
            PARSE: T.test([], T.String) 
        })

    ,update: () => model => () => model

    ,view: () => model => m(
        'div'
        , model.case == 'Parsed'
        && [
            m('a', { href: model.value.link }
                ,m('h1', model.value.title)
            )
            ,m('img', { 
                src: model.value.itunesImageHref
                ,style: { maxWidth: '100px' }
            })
            ,m('subheading', model.value.description)
            ,model.value.items.map(function(item){
                return [
                    m('heading', item.title)
                    ,m('subheading', item.itunesSubtitle)
                    ,m('p', item.description)
                    ,m('audio'
                        ,{ controls: 'controls'  
                        , preload: 'none'
                        }
                        ,m('source', {
                            src: item.enclosure.url
                        })
                    )

                ]
            })
            ,m('pre', JSON.stringify(model, null, 2))
        ]
    )
    
    ,effects: {
        DOM: () => model => unless ( ActionIs (Feed.Action) ) 
            ( () => model )
            ( sst.fold (Feed.Action) ({
                PARSE(xmlString){
        
                    // eslint-disable-next-line no-undef
                    const xml = new DOMParser().parseFromString(
                        xmlString
                            .replace(/itunes:/g, 'itunes_')
                        , 'application/xml'
                    )
                
                    const defaultNode = 
                            { innerHTML: '', getAttribute: () => '' } 
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
                    Object.assign(model, Feed.Model.Parsed(
                        channel
                    ))
                }
            })
        )
    }
    
}

const actions$ = stream()

function Compose( effectKeys, xs ){

    return {
        init: actions$ => () => {
            return xs.reduce(function(p, [$model,,c]){
                return $model(
                    $.set( c.init(actions$)() )
                )(p)
            }, {})
        }
        ,view: actions$ => model => 
            xs.reduce(function(p, [$model, $view, c]){

                const r = 
                    c.view (actions$)( $.lens.view( $model)( model ) )

                return $view( $.set(r) ) (p)
            }, m('div') )

        ,update: actions$ => model => action =>
            xs.reduce(function(previousModel, [$model,,c]){
                
                
                return $model(function(o){
                    return c.update (actions$) ( o ) ( action )
                })( previousModel )

            }, model )

        ,effects: 
            effectKeys.reduce(function(p, k){
                
                const effects = actions$ => model => action =>
                
                    xs.forEach(function([$model,, c]){

                        if(k in c.effects){
                            $model(function(o){
                                return c.effects[k](actions$) (o) (action)
                            }) (model)
                        }
                    })
                
                
                return Object.assign(p, {
                    [k]: effects
                })

            }, {})

    }
    
}

// eslint-disable-next-line fp/no-mutation
$.child.append = 
    f => $.children( xs => xs.concat([ f(xs) ]) )


function start( actions$, Component ){
    
    const { update, view, init, effects } = Component

    const model$ =
        stream.scan(function(state, action){
            
            Object.keys( effects )
                .forEach(function(k){
                    effects[k](actions$)(state)(action)
                })

            return update(actions$)(state)(action)

        }, init(actions$)(), actions$)

    const view$ =
        model$.map(function(model){
            return view(actions$)(model)
        })

    return view$.map(function(view){
        return {
            view
            ,model: model$()
            ,action: actions$()
        }
    })
}

start(
    actions$
    ,Compose(
        ['DOM']
        ,[  [ $.path(['feedInput']), $.child.append, FeedInput ]
        ,    [ $.path(['feed']), $.child.append, Feed ]
        ]
    )
)
.map(
    ({ view }) => {        
        // eslint-disable-next-line no-undef
        return m.render( document.body, view )
    }
)

// we don't need attrs
// we just send messages
actions$(
    FeedInput.Action.URL({
        url: 'https://feeds.feedburner.com/InterceptedWithJeremyScahill' 
    })
)    

// const domMount = Mount(['DOM'], actions$)

// domMount( $.root, FeedComponent )
//     .view$
//     .map( x => m.render(document.body, x) )