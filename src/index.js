const m = require('mithril')
const stream = require('mithril/stream')
const sst = require('static-sum-type/configs/dev/foldThrow.js')
const predicated = require('static-sum-type/modules/predicated/dev')
const T = require('sanctuary-def')
const toString = require('ramda/src/toString')
const $ = require('hickery/configs/mithril-immutable.js')

const Predicated = predicated(toString, e => {
    // todo-james create a config in sst
    // todo-james handle non sst errors as part of sst error type: ErrUnknown?
    if( 'type' in e && e == 'StaticSumTypeError'){
        // eslint-disable-next-line fp/no-throw
        throw new TypeError( sst.errMessage(e) )
    } else {
        // eslint-disable-next-line fp/no-throw
        throw new TypeError(e.message)
    }
})

const Feed =
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
    sst.fold( Feed )({
        URL: x => x.url
        ,Loaded: x => x.url
        ,Parsed: x => x.url
    })

const Model = (sideEffects, initialModel, actions$) => 
    stream.scan(function(p, n){

        sideEffects(actions$, p,n)

        return sst.fold( Action ) ({
            URL(){
                return {
                    feed: Feed.URL(n.value)
                }
            }
            ,FETCH(){
                return p
            }
            ,PARSE(){
                return p
            }
        }) ( n )

    }, initialModel, actions$)

function DOMSideEffects(update, p, n){
    
    // eslint-disable-next-line fp/no-mutation, no-undef
    window.state = p

    return sst.fold( Action ) ({
        URL(){}
        ,FETCH(){

            m.request({
                url: 'https://cors.now.sh/'+p.feed.value.url
                ,deserialize: i => i
                ,method: 'GET'
            })
                .then(function(response){
                    
                    // eslint-disable-next-line fp/no-mutation
                    p.feed = Feed.Loaded({
                        xml: response
                        ,url: p.feed.value.url 
                        ,originalURL: p.feed.value.url 
                    })

                    update( Action.PARSE() )
                })
        }
        ,PARSE(){

            // eslint-disable-next-line no-undef
            const xml = new DOMParser().parseFromString(
                p.feed.value.xml
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
            p.feed = Feed.Parsed({
                parsed: channel
                ,url: p.feed.value.url 
                ,originalURL: p.feed.value.url 
            })
        }
    })( n )
}



const View = update => model =>
    m(
        'div'
        , m('input'
            , { oninput: 
                m.withAttr('value', function(value){
                    update( Action.URL( value ) )
                })
                ,value: Feed$getEditableURL(model.feed)
            }
        )
        , m('button', {
            onclick(){
                update( Action.FETCH() )
            }
        }, 'Fetch')
        , model.feed.value.parsed
        && [
            m('a', { href: model.feed.value.parsed.link }
                ,m('h1', model.feed.value.parsed.title)
            )
            ,m('img', { 
                src: model.feed.value.parsed.itunesImageHref
                ,style: { maxWidth: '100px' }
            })
            ,m('subheading', model.feed.value.parsed.description)
            ,model.feed.value.parsed.items.map(function(item){
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
            ,m('pre', JSON.stringify(model.feed.value.parsed, null, 2))
        ]
    )

function Component(actions$, update, initialModel){
        
    return Model(
        DOMSideEffects
        , initialModel
        , actions$
    )
    .map( View(update) )
}

const actions$ = stream()

Component( 
    actions$
    , actions$
    ,{ 
        feed: Feed.URL({
            url: 'https://feeds.feedburner.com/InterceptedWithJeremyScahill'
        })
    }
)
    // eslint-disable-next-line no-undef
    .map( x => m.render(document.body, x) )